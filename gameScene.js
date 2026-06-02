import { CardSystem } from './cardSystem.js';
import { InventorySystem } from './inventorySystem.js';
import { GameState } from './gameState.js';
import { AmuletManager } from './AmuletManager.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { SaveManager } from './SaveManager.js';
import { MetaProgressionManager } from './MetaProgressionManager.js';
import { snapOriginToPixelGrid } from './utils/PixelSnap.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this._transitioning = false;
        this.skipNextEnemyAttack = false;
        this._turnHandlersBound = false;
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
        this.pendingEnemyTurns = 0;
    }

    init(data) {
        this.saveManager = new SaveManager();
        this.metaManager = new MetaProgressionManager(this);
        
        if (data.loadSave) {
            // Load existing run
            this.gameState = new GameState(this);
            // Load will happen in create() after systems are initialized
            this.shouldLoadSave = true;
        } else {
            // New run
            this.gameState = new GameState(this);
            // Apply relic effects to fresh game state
            this.metaManager.applyRelicEffects(this.gameState);
        }
        
        this.skipNextEnemyAttack = false;
        this.killedBy = null;
        this.roomType = data.roomType || 'COMBAT';
        this.clearEnemyTurnTimers();
    }
    
    create() {
        // Load saved volume settings
        const savedVolume = localStorage.getItem('gameVolume');
        if (savedVolume) {
            this.game.globalVolume = JSON.parse(savedVolume);
        } else {
            this.game.globalVolume = {
                master: 1.0,
                sfx: 1.0,
                music: 0.5
            };
        }
        
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
        
        // Start floor
        this.startNewFloor();
        
        // Update room title after loading
        this.updateRoomTitle();
        
        this.inventorySystem.setDiscardArea(this.discardArea);
        this.inventorySystem.setArmorPanel(this.armorPanel);
        
        // Listen for the wake event to reset the floor
        this.events.on('wake', this.wake, this);
    }

    createAnimations() {
        // Create hover card animation
        this.anims.create({
            key: 'hover_cards_anim',
            frames: [
                { key: 'hoverCardsUp1' },
                { key: 'hoverCardsUp2' },
                { key: 'hoverCardsUp3' },
                { key: 'hoverCardsUp4' },
                { key: 'hoverCardsUp5' },
            ],
            frameRate: 12,
            repeat: 0
        });
        
        // Create coin animation
        this.anims.create({
            key: 'coin_spin_anim',
            frames: [
                { key: 'coinAnimation2' },
                { key: 'coinAnimation3' },
                { key: 'coinAnimation4' },
                { key: 'coinAnimation5' },
                { key: 'coinAnimation6' }
            ],
            frameRate: 10,
            repeat: 0
        });
        
        // Create crystal animation
        this.anims.create({
            key: 'crystal_glow_anim',
            frames: [                
                { key: 'crystalAnimation2' },
                { key: 'crystalAnimation3' },
                { key: 'crystalAnimation4' },
                { key: 'crystalAnimation5' },
                { key: 'crystalAnimation1' }
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
            fontFamily: '"HoMM Pixel"',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5, 0);
        this.healthText.setDepth(30);

        // Armor equip panel under hero portrait
        this.armorPanel = snapOriginToPixelGrid(this.add.image(40, 138, 'panelArmor'));
        this.armorPanel.setInteractive();
        this.armorPanel.setDepth(5);
        this.armorPanelEquippedSprite = null;
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
            .on('pointerdown', () => this.pauseGame());
        
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
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.nextFloorButton.setTint(0xd4eaf7))
            .on('pointerout', () => {
                this.nextFloorButton.clearTint();
                this.nextFloorButton.y = 50;
                if (this.nextFloorButtonText) this.nextFloorButtonText.y = 50;
            })
            .on('pointerdown', () => {
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
        }).setOrigin(0.5);
        this.nextFloorButton.setVisible(false);
        this.nextFloorButtonText.setVisible(false);
    }

    startNewFloor() {
        this.clearEnemyTurnTimers();
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
        
        // Bind turns only once
        if (!this._turnHandlersBound) {
            this._turnHandlersBound = true;
            this.events.on('endPlayerTurn', () => this.runEnemyTurn());
        }
        // Refresh type before spawn
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        // Reset per-floor amulet flags
        this.gameState.charmingTuneUsed = false;
        this.cardSystem.spawnFloorCards();
        this.inventorySystem.addStartingCards();
        // DON'T replenish action points here
        this.updateUI();
        this.cardSystem.checkFloorClear();
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

    useAction() {
        if (this.isEnemyTurn) return false;

        // Check if player will be exhausted BEFORE consuming the action
        const willBeExhausted = this.gameState.actionsLeft <= 0;
        
        // Check for Speed Boots free first action
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
            this.finishEnemyTurnEffects();
            return;
        }

        // Check if player is blocking with spear
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
            
            this.isEnemyTurn = false;
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
                this.isEnemyTurn = false;
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
                this.isEnemyTurn = false;
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
        this.isEnemyTurn = false;
    }

    isEnemyCard(card) {
        return card?.data?.type === 'enemy' || card?.data?.type === 'eliteEnemy' || card?.data?.type === 'boss';
    }

    processEnemyAttack(card, index) {
        // Process frozen duration BEFORE checking if enemy can attack
        if (card.data.frozen && card.data.frozen > 0) {
            card.data.frozen--;

            if (card.data.frozen === 0 && card.sprite) {
                card.sprite.clearTint();
                this.createFloatingText(card.sprite.x, card.sprite.y, 'Thawed!', 0xffffff);
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

        // Charming Tune — first melee enemy on each floor skips its first attack
        if (this.amuletManager?.hasCharmingTune?.() &&
            !this.gameState.charmingTuneUsed &&
            card.data.role === 'MELEE') {
            this.gameState.charmingTuneUsed = true;
            this.createFloatingText(card.sprite.x, card.sprite.y - 20, 'Charmed (Tune)', 0xff66ff);
            return;
        }

        // Siren's Pendant — chance to redirect attack onto another enemy
        const charmChance = this.amuletManager?.getCharmChance?.() || 0;
        if (charmChance > 0 && Math.random() < charmChance) {
            const others = this.cardSystem.boardCards
                .map((c, i) => ({ card: c, index: i }))
                .filter(({ card: c, index: i }) =>
                    c && c.revealed && i !== index &&
                    (c.data?.type === 'enemy' || c.data?.type === 'boss')
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

        const damageDealt = card.data.attack;
        this.createDamageEffect(card.sprite.x, card.sprite.y);

        // Apply abilities like poison on hit
        card.data.abilities?.forEach(ability => {
            if (ability.type === 'poison') {
                this.gameState.addPlayerEffect({ ...ability });
                this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Poisoned!', 0x00ff00);
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
        const { actualDamage, tookDamage } = this.gameState.takeDamage(damageDealt, index);

        if (tookDamage) {
            SoundHelper.playSound(this, 'player_hurt', 0.5);
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage}`, 0xff0000);

            if (playerHealthBeforeDamage > 0 && this.gameState.playerHealth <= 0) {
                this.killedBy = card.data.name || card.data.type || 'Enemy';
            }
        }

        // Boss LIFESTEAL — the leech heals from the damage it dealt (off raw
        // attack so player armor doesn't neuter it). This ability was previously
        // defined but never applied.
        const leech = card.data.abilities?.find(a => a.type === 'lifesteal');
        if (leech) {
            const heal = Math.max(1, Math.ceil(damageDealt * (leech.percentage || 0.3)));
            if (card.data.maxHealth === undefined) card.data.maxHealth = card.data.health;
            card.data.health = Math.min(card.data.maxHealth, card.data.health + heal);
            this.cardSystem.updateEnemyInfoText?.(card);
            if (card.sprite) this.createFloatingText(card.sprite.x, card.sprite.y - 16, `+${heal} Leech`, 0x66ff66);
        }

        this.applyThornsDamage(card, index);
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

    applyThornsDamage(card, index) {
        if (this.cardSystem.boardCards[index] !== card) return;
        if (card.data.role !== 'MELEE') return;

        const thorns = this.getActiveThornsCard();
        if (!thorns) return;

        const damage = thorns.item.thornDamage || 2;
        const x = card.sprite?.x || this.playerAvatar.x;
        const y = card.sprite?.y || this.playerAvatar.y;

        this.cardSystem.attackEnemy(index, damage, true);
        this.createFloatingText(x, y, `-${damage} Thorns`, 0x9dff7a);

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

    finishEnemyTurnEffects() {
        this.isEnemyTurn = false;

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
        for (let i = this.gameState.playerEffects.length - 1; i >= 0; i--) {
            const effect = this.gameState.playerEffects[i];
            if (effect.type === 'poison') {
                effectDamage += effect.damage;
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
                this.killedBy = 'Poison';
            }
            
            // Check for game over after poison damage
            if (this.gameState.playerHealth <= 0) {
                this.time.delayedCall(100, () => this.gameOver());
                return;
            }
        }
        
        this.updateUI();
        if (this.gameState.playerHealth <= 0) {
            this.time.delayedCall(500, () => this.gameOver());
            return;
        }
        // Run the next queued enemy turn, if any actions stacked up during this one.
        this._drainEnemyTurns();
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
        // IMPORTANT: Check for game over immediately after taking damage
        if (this.gameState.playerHealth <= 0) {
            this.time.delayedCall(500, () => this.gameOver());
        }
    }
    createFloatingText(x, y, text, color) {
        // Small random spawn offset so simultaneous texts don't stack exactly
        const xOffset = Phaser.Math.Between(-12, 12);
        const yOffset = Phaser.Math.Between(-6, 6);
        const floatText = this.add.text(x + xOffset, y + yOffset, text, {
            fontSize: '16px',
            fill: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        // Phase 1: drift up a little, stay fully visible so the player can read it
        this.tweens.add({
            targets: floatText,
            y: floatText.y - 28,
            duration: 500,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                // Phase 2: short hold then gentle fade in place
                this.tweens.add({
                    targets: floatText,
                    alpha: 0,
                    duration: 700,
                    delay: 250,
                    ease: 'Linear',
                    onComplete: () => floatText.destroy()
                });
            }
        });
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
        // Clear the current run save (but keep meta progression)
        if (this.saveManager) {
            this.saveManager.clearCurrentRun();
        }
        
        // Update meta progression stats
        if (this.metaManager) {
            this.metaManager.totalRuns++;
            if (this.gameState.currentFloor > this.metaManager.bestFloor) {
                this.metaManager.bestFloor = this.gameState.currentFloor;
            }
            this.metaManager.saveMetaProgression();
        }
        
        // Get death statistics for meta progression and include killer info
        const deathStats = this.gameState.getDeathStats();
        
        // Add killer information to death stats
        deathStats.killedBy = this.killedBy || 'Unknown Enemy';
        
        this.add.rectangle(320, 180, 300, 150, 0x000000, 0.8).setOrigin(0.5);
        this.add.text(320, 140, 'GAME OVER', {
            fontSize: '28px',
            fill: '#ff0000',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        this.add.text(320, 180, `You reached floor ${this.gameState.currentFloor}`, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Launch DeathRewardScene instead of simple restart
        const continueButton = this.add.rectangle(320, 220, 120, 30, 0x333333)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive()
            .on('pointerdown', () => {
                this.scene.start('DeathRewardScene', { 
                    deathStats: deathStats,
                    gameState: this.gameState,
                    metaManager: this.metaManager,
                    killedBy: this.killedBy || 'Unknown Enemy'
                });
            });
        this.add.text(320, 220, 'Continue', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
    }
    
    floorCleared() {
        if (this._transitioning) return;

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
        // Give a modest floor clear payout; elite chests pay out separately.
        // Cut hard — the economy was badly over-fauceted (gold piled up unspent).
        const baseReward = 1 + Math.floor(this.gameState.currentFloor / 3);

        // Apply gold modifier from amulets
        const reward = this.amuletManager ?
            this.amuletManager.modifyGoldFound(baseReward) : baseReward;

        this.gameState.coins += reward;
        SoundHelper.playSound(this, 'coin_collect', 0.4);
        this.createFloatingText(320, 180, `Floor Cleared! +${reward} coins`, 0xffd700);

        // Elite rooms still use the chest-click TreasureScene flow
        const rewardChestMode = this.gameState.roomType === 'ELITE' ? 'elite' : null;

        // Process amulet floor end effects before moving to next floor
        if (this.amuletManager) {
            this.amuletManager.processFloorEnd();
        }

        const completedActBoss = this.gameState.roomType === 'BOSS' &&
            this.gameState.mapCursor &&
            this.gameState.mapCursor.floor >= 14;

        if (completedActBoss) {
            // Final boss → straight to victory, no reward room
            if (this.gameState.currentFloor >= 45) {
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
        if (this.nextFloorButton) {
            this.nextFloorButton.setVisible(true);
            this.nextFloorButton.setInteractive();
            this.nextFloorButton.clearTint();
        }
        if (this.nextFloorButtonText) this.nextFloorButtonText.setVisible(true);

        this.updateUI();
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
    
    onEnemiesCleared() {
        this.clearEnemyTurnTimers();
        this.enemiesCleared = true;
        // Null-guard: if the button hasn't been (re)created yet, do NOT throw
        // — that would leave enemiesCleared=true with a still-hidden button,
        // and the next checkFloorClear would short-circuit on !enemiesCleared.
        if (this.nextFloorButton) {
            this.nextFloorButton.setVisible(true);
            this.nextFloorButton.setInteractive();
            this.nextFloorButton.clearTint();
        }
        this.nextFloorButtonText?.setVisible(true);
        this.createFloatingText(320, 100, 'All enemies defeated!', 0x00ff00);
        this.createFloatingText(320, 120, 'Clear remaining cards or proceed.', 0xffffff);
    }
    
    gameWon() {
        this.add.rectangle(320, 180, 400, 150, 0x000000, 0.8).setOrigin(0.5);
        this.add.text(320, 140, 'VICTORY!', {
            fontSize: '28px',
            fill: '#ffd700',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        this.add.text(320, 180, `You have conquered the dungeon!`, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        const restartButton = this.add.rectangle(320, 220, 120, 30, 0x333333)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('GameScene', {}));
        this.add.text(320, 220, 'Play Again', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
    }
    
    updateAmuletsUI() {
        this.amuletUIGroup.clear(true, true);
        if (this.amuletTooltip) {
            this.amuletTooltip.destroy();
            this.amuletTooltip = null;
        }

        const amulets = this.gameState.activeAmulets;
        const MAX_VISIBLE = 10;
        const SPACING = 35;
        const ROW_X = 125;
        const ROW_Y = 48;

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
        relics.forEach((relic, i) => {
            const x = 125 + i * 28;
            const y = 16;
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

        const description = `${relic.name}\n${relic.description}`;
        const bg = this.add.rectangle(0, 0, 200, 44, 0x000000, 0.85)
            .setStrokeStyle(1, relic.cursed ? 0xff6666 : 0xffd700);
        const tooltipText = this.add.text(0, 0, description, {
            fontSize: '10px',
            fill: relic.cursed ? '#ff9999' : '#ffd700',
            fontFamily: '"HoMM Pixel"',
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
        let lines = `${armor.name}\nProtection: ${armor.protection}`;
        if (armor.dodgeChance) {
            lines += `\nDodge: ${Math.round(armor.dodgeChance * 100)}%`;
        }
        if (armor.reflection) {
            lines += `\nReflect: ${armor.reflection}%`;
        }
        lines += `\nDur: ${armor.durability}/${armor.maxDurability}`;

        const tooltipX = Math.round(this.armorPanel.x + 50);
        const tooltipY = Math.round(this.armorPanel.y - 20);
        const tooltipText = this.add.text(0, 0, lines, {
            fontSize: '10px',
            fill: '#66aaff',
            fontFamily: '"HoMM Pixel"',
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
        this.createFloatingText(x, y - 18, `+${amount} Max HP (Tent)`, 0xffd78a);
        this.updateUI();
    }

    recordCardDiscarded(card, x = this.playerAvatar.x, y = this.playerAvatar.y) {
        if (!card) return;

        this.gameState.discardedCardsThisRun = (this.gameState.discardedCardsThisRun || 0) + 1;

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
        
        let description = amulet.name;
        
        if (definition) {
            description += `\n${definition.description}`;
            
            // Add level info for stackable amulets
            if (amulet.level && amulet.level > 1) {
                description += ` (Level ${amulet.level})`;
            }
            
            // Add uses left for limited use amulets
            if (amulet.usesLeft !== undefined) {
                description += `\n(${amulet.usesLeft} uses left)`;
            }
            
            // Add cursed indicator
            if (definition.cursed) {
                description = `[CURSED] ${description}`;
            }
        }
        
        const tooltipText = this.add.text(0, 0, description, {
            fontSize: '11px',
            fill: definition && definition.cursed ? '#ff6666' : '#ffffff',
            fontFamily: '"HoMM Pixel"',
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
        // Story consequence state
        if (runData.story?.storyRun) {
            this.gameState.storyRun = runData.story.storyRun;
        }
        if (runData.story?.heroMemory) {
            this.gameState.heroMemory = runData.story.heroMemory;
        }
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
        this.input.keyboard.off('keydown-ESC');
        this.events.off('endPlayerTurn');  // Unbind to avoid doubles
        this._turnHandlersBound = false;
    }
    wake(sys, data) {
        // Always sync inventory on wake
        if (this.inventorySystem) {
            this.inventorySystem.slots = this.gameState.inventory || this.inventorySystem.slots;
            this.gameState.inventory = this.inventorySystem.slots;
            this.inventorySystem.rebuildInventorySprites();
            this.inventorySystem.setVisibility(true);
        }
        if (data?.shopStation) {
            this.inventorySystem?.setStationMode(true);
            // Clear the previous floor's cards so they don't bleed through the shop UI.
            this.cardSystem?.clearBoard?.();
            // Also hide the room title (it would still say "Combat Room" from the prior floor).
            if (this.roomTitle) this.roomTitle.setText('');
            this.updateUI();
            return;
        }
        // Restore current room type from gameState
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        
        // Check if this is actually a new floor/room transition
        const isNewRoom = data?.isNewRoom || false;
        
        if (['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType)) {
            // Check if we need to spawn new enemies. Include 'eliteEnemy'
            // — it's a third enemy type used throughout cardSystem; missing
            // it here would cause an unresolved-enemy room to look empty
            // and skip the respawn.
            const isEnemyType = (t) => t === 'enemy' || t === 'boss' || t === 'eliteEnemy';
            const hasEnemies = this.cardSystem.boardCards &&
                this.cardSystem.boardCards.some(c => c && isEnemyType(c.data?.type));

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

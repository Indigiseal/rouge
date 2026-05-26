import { CardSystem } from './cardSystem.js';
import { InventorySystem } from './inventorySystem.js';
import { GameState } from './gameState.js';
import { AmuletManager } from './AmuletManager.js';
import { SoundHelper } from './utils/SoundHelper.js';
import { SaveManager } from './SaveManager.js';
import { MetaProgressionManager } from './MetaProgressionManager.js';

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this._transitioning = false;
        this.skipNextEnemyAttack = false;
        this._turnHandlersBound = false;
        this.enemyTurnTimers = [];
        this.enemyTurnQueued = false;
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
        this.roomTitle = this.add.text(320, 10, '', { fontSize: '20px', fill: '#ffffff', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        this.updateRoomTitle();
        
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
        this.playerAvatar = this.add.image(45, 45, 'MainPlayerAvatar');
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

        // Armor equip panel under hero portrait
        this.armorPanel = this.add.image(39, 138, 'panelArmor');
        this.armorPanel.setInteractive();
        this.armorPanel.setDepth(5);
        this.armorPanelEquippedSprite = null;
        this.armorPanelInfoText = null;

        // Action points: each diamond is four AP, with spent quadrants darkened.
        this.actionPointSprites = [];
        this.actionPointOverlays = [];
        this.createActionPointUI();
        
        // Coin and Crystal UI under armor panel with animations
        this.coinSprite = this.add.sprite(25, 216, 'coinUI').setScale(1);
        this.coinsText = this.add.text(25, 233, '0', {
            fontSize: '12px',
            fill: '#cf8834',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        this.crystalSprite = this.add.sprite(60, 216, 'CrystalUI').setScale(1);
        this.crystalsText = this.add.text(60, 233, '0', {
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
        // Equipped armor text (moved down to make room for amulets above)
        this.equippedArmorText = this.add.text(125, 90, 'Armor: None', {
            fontSize: '12px',
            fill: '#aaaaaa',
            fontFamily: '"HoMM Pixel"'
        });
        this.floorText = this.add.text(520, 15, 'Floor: 1', {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Pause button - positioned in top right corner
        const pauseButton = this.add.rectangle(600, 15, 60, 25, 0x444444)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => pauseButton.setFillStyle(0x666666))
            .on('pointerout', () => pauseButton.setFillStyle(0x444444))
            .on('pointerdown', () => this.pauseGame());
        
        this.add.text(600, 15, 'PAUSE', {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Also add ESC key binding for pause
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        // Discard area
        this.discardArea = this.add.image(585, 320, 'discardSprite');
        this.add.text(585, 320, 'Discard', { fontSize: '12px', fill: '#d3beb2', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
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
        this.nextFloorButton = this.add.image(595, 50, 'nextTurnUp')
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => this.nextFloorButton.setTint(0xd4eaf7))
            .on('pointerout', () => { this.nextFloorButton.clearTint(); this.nextFloorButton.y = 50; })
            .on('pointerdown', () => { this.nextFloorButton.setTint(0x888888); this.nextFloorButton.y = 51; this.floorCleared(); })
            .on('pointerup', () => { this.nextFloorButton.clearTint(); this.nextFloorButton.y = 50; });
        this.nextFloorButton.setVisible(false);
    }

    startNewFloor() {
        this.clearEnemyTurnTimers();
        this._transitioning = false;
        this.enemiesCleared = false;
        if (this.nextFloorButton) {
            this.nextFloorButton.setVisible(false);
            this.nextFloorButton.setInteractive();
            this.nextFloorButton.y = 50;
            this.nextFloorButton.clearTint();
        }
        this.skipNextEnemyAttack = true;  // Grace period—no instant zap
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
        
        // Update equipped armor text - REMOVED reflection display
        if (this.gameState.equippedArmor) {
            const armor = this.gameState.equippedArmor;
            let armorText = `Equipped: ${armor.name}\n` + 
                           `Protection: ${armor.protection}\n`;
            
            if (armor.dodgeChance) {
                armorText += `Dodge: ${Math.round(armor.dodgeChance * 100)}%\n`;
            }
            
            armorText += `Dur: ${armor.durability}/${armor.maxDurability}`;
            
            this.equippedArmorText.setText(armorText);
            this.equippedArmorText.setStyle({
                fill: '#66aaff',
                fontSize: '10px',
                lineSpacing: 2
            });
        } else {
            this.equippedArmorText.setText('Equipped: None');
            this.equippedArmorText.setStyle({
                fill: '#aaaaaa',
                fontSize: '12px'
            });
        }
        this.floorText.setText(`Floor: ${this.gameState.currentFloor}`);
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
        const spacing = 18;
        const startX = 52 - ((nodeCount - 1) * spacing) / 2;
        const y = 184;

        for (let i = 0; i < nodeCount; i++) {
            const x = startX + i * spacing;
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

        this.armorPanelEquippedSprite = this.add.image(this.armorPanel.x, this.armorPanel.y, armor.sprite);
        this.armorPanelEquippedSprite.setDepth(6);
        this.armorPanelEquippedSprite.setInteractive({ useHandCursor: true });
        this.armorPanelEquippedSprite.on('pointerdown', () => {
            this.inventorySystem?.unequipArmor?.();
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
        if (this.enemyTurnQueued || this.isEnemyTurn || this._transitioning || this.enemiesCleared) return;
        this.enemyTurnQueued = true;
        const timer = this.time.delayedCall(500, () => {
            this.enemyTurnQueued = false;
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
      if (this.skipNextEnemyAttack) {
        this.skipNextEnemyAttack = false;
        return;  // No attack on entry
      }
      this.isEnemyTurn = true;
      this.revealedEnemiesAttack();
    }
    revealedEnemiesAttack() {
        if (this.gameState.playerHealth <= 0) return; // Don't attack a dead player.
        
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
            // Find the first attacking enemy
            let firstAttacker = null;
            for (let i = 0; i < this.cardSystem.boardCards.length; i++) {
                const card = this.cardSystem.boardCards[i];
                if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
                    // Skip frozen enemies
                    if (card.data.frozen && card.data.frozen > 0) {
                        continue;
                    }
                    firstAttacker = { card, index: i };
                    break;
                }
            }
            
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
            // Find the first attacking enemy
            let firstAttacker = null;
            for (let i = 0; i < this.cardSystem.boardCards.length; i++) {
                const card = this.cardSystem.boardCards[i];
                if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
                    // Skip frozen enemies
                    if (card.data.frozen && card.data.frozen > 0) {
                        continue;
                    }
                    firstAttacker = { card, index: i };
                    break;
                }
            }
            
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
        
        const attackers = this.cardSystem.boardCards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => card && card.revealed && this.isEnemyCard(card));

        if (attackers.length === 0) {
            this.finishEnemyTurnEffects();
            return;
        }

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

        // BOSS SUMMONING ABILITY - Process before attack
        if (card.data.type === 'boss' && card.data.abilities) {
            card.data.abilities.forEach(ability => {
                if (ability.type === 'summon' && Math.random() < ability.chance) {
                    this.cardSystem.summonEnemy(ability.enemyType, card);
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
        }
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
        // Add random offsets to prevent text from overlapping perfectly
        const xOffset = Phaser.Math.Between(-20, 20);
        const yOffset = Phaser.Math.Between(-10, 10);
        const floatText = this.add.text(x + xOffset, y + yOffset, text, {
            fontSize: '16px',
            fill: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Make the text drift horizontally as it floats up
        this.tweens.add({
            targets: floatText,
            x: floatText.x + Phaser.Math.Between(-50, 50),
            y: floatText.y - 80,
            alpha: 0,
            duration: 3000,
            ease: 'Cubic.easeOut',
            onComplete: () => floatText.destroy()
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
        this._transitioning = true;
        this.clearEnemyTurnTimers();
        // Hard-disable the button so it can't be clicked again
        if (this.nextFloorButton) this.nextFloorButton.disableInteractive();
        // Give a modest floor clear payout; elite and boss rooms now pay out through chests.
        const baseReward = 3 + this.gameState.currentFloor;
        
        // Apply gold modifier from amulets
        const reward = this.amuletManager ? 
            this.amuletManager.modifyGoldFound(baseReward) : baseReward;
        
        this.gameState.coins += reward;
        SoundHelper.playSound(this, 'coin_collect', 0.4);
        this.createFloatingText(320, 180, `Floor Cleared! +${reward} coins`, 0xffd700);
        const rewardChestMode = this.gameState.roomType === 'BOSS' ? 'boss' :
            this.gameState.roomType === 'ELITE' ? 'elite' : null;
        
        // Process amulet floor end effects before moving to next floor
        if (this.amuletManager) {
            this.amuletManager.processFloorEnd();
        }

        const completedActBoss = this.gameState.roomType === 'BOSS' &&
            this.gameState.mapCursor &&
            this.gameState.mapCursor.floor >= 14;

        if (completedActBoss) {
            if (this.gameState.currentFloor >= 45) {
                this.saveCurrentRun();
                this.time.delayedCall(1500, () => this.gameWon());
                return;
            }

            this.gameState.currentFloor++;
            const nextAct = Math.floor((this.gameState.currentFloor - 1) / 15) + 1;
            this.gameState.mapCursor = { act: nextAct, floor: 0, node: 0 };
            const nextActMap = this.gameState.dungeonMap?.[`act${nextAct}`];
            if (nextActMap?.floors?.[0]?.[0]) {
                nextActMap.floors[0][0].visited = true;
            }
            this.createFloatingText(320, 120, `Act ${nextAct}`, 0xf2d3aa);
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
    
    onEnemiesCleared() {
        this.clearEnemyTurnTimers();
        this.enemiesCleared = true;
        this.nextFloorButton.setVisible(true);
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
        // Display amulets horizontally above armor text
        this.gameState.activeAmulets.forEach((amulet, i) => {
            // Position amulets horizontally starting from x=125, y=65
            const x = 125 + i * 35; // 35 pixels spacing between amulets
            const y = 30; // Above the armor text which is now at y=90
            const amuletSprite = this.add.image(x, y, amulet.sprite, amulet.spriteFrame).setInteractive();
            this.amuletUIGroup.add(amuletSprite);
            
            // Add level indicator for stackable amulets
            if (amulet.level && amulet.level > 1) {
                const levelText = this.add.text(x + 8, y + 8, amulet.level.toString(), {
                    fontSize: '10px',
                    fill: '#ffffff',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
                this.amuletUIGroup.add(levelText);
            }
            
            // Add hover tooltip
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
            const y = 62;
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
    
    updatePlayerEffectsUI() {
        this.playerEffectsUIGroup.clear(true, true);
        this.gameState.playerEffects.forEach((effect, i) => {
            const y = 312 + i * 15;
            let effectText = '';
            let color = '#ffffff';
            switch (effect.type) {
                case 'poison':
                    effectText = `Poison (${effect.turns} turns)`;
                    color = '#00ff00';
                    break;
            }
            const text = this.add.text(10, y, effectText, {
                fontSize: '12px',
                fill: color,
                fontFamily: '"HoMM Pixel"'
            });
            this.playerEffectsUIGroup.add(text);
        });
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
        this.amuletTooltip.setDepth(10);
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
        // Inventory
        if (this.inventorySystem && runData.equipment.inventory) {
            this.inventorySystem.slots = runData.equipment.inventory;
            this.gameState.inventory = this.inventorySystem.slots;
            this.inventorySystem.createInventoryUI();
            this.inventorySystem.rebuildInventorySprites();
        }
        // Re-apply relic effects on top of loaded state
        if (this.metaManager) {
            this.metaManager.applyRelicEffects(this.gameState, false);
        }
        return true;
    }
    
    updateRoomTitle() {
        let title = 'Combat Room';
        if (this.roomType === 'ELITE') title = 'Elite Combat';
        if (this.roomType === 'BOSS') title = 'Boss Fight';
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
            this.updateUI();
            return;
        }
        // Restore current room type from gameState
        this.roomType = this.gameState.roomType || 'COMBAT';
        this.updateRoomTitle();
        
        // Check if this is actually a new floor/room transition
        const isNewRoom = data?.isNewRoom || false;
        
        if (['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType)) {
            // Check if we need to spawn new enemies
            const hasEnemies = this.cardSystem.boardCards && 
                this.cardSystem.boardCards.some(c => 
                    c && (c.data?.type === 'enemy' || c.data?.type === 'boss')
            );
            
            if (!hasEnemies || isNewRoom) {
                this.startNewFloor();
            } else {
                this.updateUI(); // Refresh UI without spawning
            }
        }
    }
}

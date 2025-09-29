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
        this._handleEndPlayerTurn = () => this.runEnemyTurn();
        this._activeRoomId = null;
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
        console.log('GameScene roomType:', this.roomType);

        // Ensure room tracking defaults exist
        if (!Number.isFinite(this.gameState.activeRoomId)) {
            this.gameState.activeRoomId = 0;
        }
        if (typeof this.gameState.roomInitialized !== 'boolean') {
            this.gameState.roomInitialized = false;
        }
        this.gameState.roomType = this.gameState.roomType || this.roomType;
        this._activeRoomId = this.gameState.activeRoomId;
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
        console.log('InventorySystem created:', this.inventorySystem);
        
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
        this.roomTitle = this.add.text(320, 10, '', { fontSize: '20px', fill: '#ffffff', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
        this.updateRoomTitle();
        
        // Start floor if needed
        if (this.shouldStartNewFloor()) {
            this.startNewFloor();
        } else {
            this.updateRoomTitle();
            this.updateUI();
        }
        
        // Update room title after loading
        this.updateRoomTitle();
        
        this.inventorySystem.setDiscardArea(this.discardArea);
        
        // Listen for the wake event to reset the floor
        this.events.on('wake', () => {
            console.log('GameScene wake roomType:', this.gameState.roomType);
            console.log('Current inventory:', this.inventorySystem?.slots);
            console.log('GameState inventory:', this.gameState.inventory);
            
            // Force inventory sync on wake
            if (this.inventorySystem) {
                this.inventorySystem.slots = this.gameState.inventory || this.inventorySystem.slots;
                this.gameState.inventory = this.inventorySystem.slots;
                this.inventorySystem.rebuildInventorySprites(); // Redraw UI
            }
            
            this.roomType = this.gameState.roomType || 'COMBAT';
            console.log('GameScene wake roomType:', this.roomType);
            
            if (this.inventorySystem) {
                console.log('Waking inventory - forcing visibility true');
                this.inventorySystem.setVisibility(true);
                this.inventorySystem.rebuildInventorySprites();
            }
            
            if (this.shouldStartNewFloor()) {
                this.startNewFloor();
            } else {
                console.log('Skipped startNewFloor - room already active');
                this.updateRoomTitle();
                this.inventorySystem.rebuildInventorySprites();
            }
        }, this);
    }

    shouldStartNewFloor() {
        if (!['COMBAT', 'ELITE', 'BOSS'].includes(this.roomType)) {
            return false;
        }

        if (!this.gameState) {
            return true;
        }

        const activeId = Number.isFinite(this.gameState.activeRoomId)
            ? this.gameState.activeRoomId
            : 0;

        if (!this.gameState.roomInitialized) {
            return true;
        }

        return this._activeRoomId !== activeId;
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
        // Health bar under avatar
        this.add.image(45, 95, 'healthBarEmpty');
        this.healthBar = this.add.image(45, 95, 'healthBar');
        this.healthText = this.add.text(45, 110, 'HP: 50/50', {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5, 0);
        
        // Coin and Crystal UI under health bar with animations
        this.coinSprite = this.add.sprite(35, 130, 'coinUI').setScale(1);
        this.coinsText = this.add.text(35, 147, '0', {
            fontSize: '12px',
            fill: '#cf8834',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        this.crystalSprite = this.add.sprite(70, 130, 'CrystalUI').setScale(1);
        this.crystalsText = this.add.text(70, 147, '0', {
            fontSize: '12px',
            fill: '#a83c69',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // Store previous values to detect changes
        this.previousCoins = 0;
        this.previousCrystals = 0;
        
        this.actionsText = this.add.text(125, 45, 'Actions: 3/3', {
            fontSize: '12px',
            fill: '#00ff00',
            fontFamily: '"Roboto Condensed"'
        });
        // Amulets displayed horizontally above armor info
        this.amuletUIGroup = this.add.group();
        // Equipped armor text (moved down to make room for amulets above)
        this.equippedArmorText = this.add.text(125, 90, 'Armor: None', {
            fontSize: '12px',
            fill: '#aaaaaa',
            fontFamily: '"Roboto Condensed"'
        });
        this.floorText = this.add.text(520, 15, 'Floor: 1', {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // Also add ESC key binding for pause
        this.input.keyboard.on('keydown-ESC', () => this.pauseGame());
        // Discard area
        this.discardArea = this.add.image(45, 320, 'discardSprite');
        this.add.text(45, 320, 'Discard', { fontSize: '12px', fill: '#d3beb2', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
        // Rest button removed - players must manage action points carefully
        // Amulet UI
        // Player effects label
        this.add.text(45, 170, 'Effects', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5, 0);
        this.playerEffectsUIGroup = this.add.group();
        // Next Floor Button (initially hidden)
        this.nextFloorButton = this.add.rectangle(570, 80, 100, 30, 0x006400)
            .setStrokeStyle(2, 0x00ff00)
            .setInteractive()
            .on('pointerdown', () => this.floorCleared());
        this.nextFloorButtonText = this.add.text(570, 80, 'Next Floor', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        this.nextFloorButton.setVisible(false);
        this.nextFloorButtonText.setVisible(false);
    }

    startNewFloor() {
        this._transitioning = false;
        this.enemiesCleared = false;
        this.nextFloorButton?.setVisible(false);
        this.nextFloorButtonText?.setVisible(false);
        this.nextFloorButton?.setInteractive();
        this.skipNextEnemyAttack = true;  // Grace period—no instant zap
        this.gameState.health = Math.max(1, Math.floor(this.gameState.health || 55));  // Sanitize HP
        this.gameState.maxHealth = Math.max(1, Math.floor(this.gameState.maxHealth || 55));
        if (this.gameState.health > this.gameState.maxHealth) this.gameState.health = this.gameState.maxHealth;
        
        // Armor safety net
        if (this.gameState.equippedArmor) {
            this.gameState.equippedArmor.protection = Math.max(0, Math.floor(this.gameState.equippedArmor.protection || 0));
            this.gameState.equippedArmor.durability = Math.max(0, Math.floor(this.gameState.equippedArmor.durability || 25));
        }
        
        console.log('[ROOM ENTER] HP safe?', { health: this.gameState.health, armor: this.gameState.equippedArmor });
        
        // Bind enemy turn handler safely
        this.events.off('endPlayerTurn', this._handleEndPlayerTurn);
        this.events.on('endPlayerTurn', this._handleEndPlayerTurn);
        this._turnHandlersBound = true;

        // Update active room tracking
        if (!Number.isFinite(this.gameState.activeRoomId)) {
            this.gameState.activeRoomId = 0;
        }
        this._activeRoomId = this.gameState.activeRoomId;
        this.gameState.roomInitialized = true;
        const resolvedRoomType = this.gameState.roomType || this.roomType || 'COMBAT';
        this.roomType = resolvedRoomType;
        this.gameState.roomType = resolvedRoomType;
        // Refresh type before spawn
        console.log('startNewFloor roomType:', this.roomType);
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
        
        console.log('=== INVENTORY SYNC CHECK ===');
        console.log('inventorySystem.slots:', this.inventorySystem?.slots);
        console.log('gameState.inventory:', this.gameState.inventory);
        console.log('========================');
        
        this.healthText.setText(`HP: ${this.gameState.playerHealth}/${this.gameState.maxHealth}`);
        
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
        this.actionsText.setText(`Actions: ${this.gameState.actionsLeft}/${this.gameState.maxActions}`);
        
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
        
        // Update health bar
        const healthPercent = Math.max(0, this.gameState.playerHealth / this.gameState.maxHealth);
        this.healthBar.setCrop(0, 0, this.healthBar.width * healthPercent, this.healthBar.height);
        this.updateAmuletsUI();
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

    useAction() {
        // Check if player will be exhausted BEFORE consuming the action
        const willBeExhausted = this.gameState.actionsLeft <= 0;
        
        // Check for Speed Boots free first action
        if (this.gameState.shouldUseFreeAction()) {
            this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, 'Free Action!', 0x00ff00);
            this.updateUI();
            // After any action, revealed enemies attack
            this.time.delayedCall(500, () => this.events.emit('endPlayerTurn'));
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
        // After any action, emit the end of player turn event
        this.time.delayedCall(500, () => this.events.emit('endPlayerTurn'));
        
        return true; // Always return true to allow actions
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
      if (this.skipNextEnemyAttack) {
        this.skipNextEnemyAttack = false;
        console.log('[ENEMY TURN SKIPPED] Grace over—your move!');
        return;  // No attack on entry
      }
      
      console.log('[ENEMY TURN START] Attacking...');
      this.revealedEnemiesAttack();
      
      // At end of turn
      this.updateUI();
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
                return; // Mirror shield blocks all attacks this action
            }
        }
        
        // Process individual enemy attacks AND boss abilities
        this.cardSystem.boardCards.forEach((card, index) => {
            if (card && card.revealed && (card.data.type === 'enemy' || card.data.type === 'boss')) {
                // Process frozen duration BEFORE checking if enemy can attack
                if (card.data.frozen && card.data.frozen > 0) {
                    card.data.frozen--;
                    
                    if (card.data.frozen === 0 && card.sprite) {
                        card.sprite.clearTint(); // Remove ice blue tint when unfrozen
                        this.createFloatingText(card.sprite.x, card.sprite.y, 'Thawed!', 0xffffff);
                    } else {
                        this.createFloatingText(card.sprite.x, card.sprite.y, `Frozen (${card.data.frozen})`, 0x00ccff);
                    }
                    return; // Skip this enemy's attack while frozen
                }
                
                // BOSS SUMMONING ABILITY - Process before attack
                if (card.data.type === 'boss' && card.data.abilities) {
                    card.data.abilities.forEach(ability => {
                        if (ability.type === 'summon' && Math.random() < ability.chance) {
                            this.cardSystem.summonEnemy(ability.enemyType, card);
                        }
                    });
                }
                
                // Enemy attacks if not frozen
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
                
                // Check if this damage will kill the player and track the killer
                const playerHealthBeforeDamage = this.gameState.playerHealth;
                
                // Player takes damage and reflection is handled inside takeDamage
                const { actualDamage, tookDamage } = this.takeDamage(damageDealt);
                
                if (tookDamage) {
                    SoundHelper.playSound(this, 'player_hurt', 0.5);
                    this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, `-${actualDamage}`, 0xff0000);
                    
                    // Track the killer if this attack was fatal
                    if (playerHealthBeforeDamage > 0 && this.gameState.playerHealth <= 0) {
                        this.killedBy = card.data.name || card.data.type || 'Enemy';
                    }
                }
            }
        });
        
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
            const { actualDamage, tookDamage } = this.takeDamage(effectDamage);
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
    takeDamage(rawDamage) {
      const dmg = Math.max(0, Math.floor(rawDamage || 0));
      console.log('[DAMAGE IN]', { raw: dmg, hpBefore: this.gameState.health });
      // Armor block
      const armor = this.gameState.equippedArmor;
      const defend = Math.max(0, Math.floor(armor?.protection || 0));
      const afterArmor = Math.max(0, dmg - defend);
      
      // Durability tick (if hit)
      if (armor && dmg > 0 && armor.durability > 0) {
        armor.durability = Math.max(0, armor.durability - 1);
        if (armor.durability === 0) {
          armor.protection = 0;  // Broke
          this.createFloatingText(this.playerAvatar.x, this.playerAvatar.y, "Armor Shattered!", 0xff6666);
        }
      }
      
      this.gameState.health = Math.max(0, this.gameState.health - afterArmor);
      console.log('[DAMAGE OUT]', { afterArmor, hpAfter: this.gameState.health });
      
      if (this.gameState.health <= 0) {
        // Death stuff
        console.log('[DEATH] Oof—game over');
        this.gameOver();
      }
      
      return { actualDamage: afterArmor, tookDamage: afterArmor > 0 };
    }
    createFloatingText(x, y, text, color) {
        // Add random offsets to prevent text from overlapping perfectly
        const xOffset = Phaser.Math.Between(-20, 20);
        const yOffset = Phaser.Math.Between(-10, 10);
        const floatText = this.add.text(x + xOffset, y + yOffset, text, {
            fontSize: '16px',
            fill: Phaser.Display.Color.IntegerToColor(color).rgba,
            fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        this.add.text(320, 180, `You reached floor ${this.gameState.currentFloor}`, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
    }
    
    floorCleared() {
        if (this._transitioning) return;
        this._transitioning = true;
        // Hard-disable the button so it can't be clicked again
        if (this.nextFloorButton) this.nextFloorButton.disableInteractive();
        // Give some coins for clearing the floor
        const baseReward = 5 + this.gameState.currentFloor * 2;
        
        // Apply gold modifier from amulets
        const reward = this.amuletManager ? 
            this.amuletManager.modifyGoldFound(baseReward) : baseReward;
        
        this.gameState.coins += reward;
        SoundHelper.playSound(this, 'coin_collect', 0.4);
        this.createFloatingText(320, 180, `Floor Cleared! +${reward} coins`, 0xffd700);
        
        // Process amulet floor end effects before moving to next floor
        if (this.amuletManager) {
            this.amuletManager.processFloorEnd();
        }
        
        // AUTO-SAVE the current run
        this.saveCurrentRun();
        
        this.time.delayedCall(1500, () => {
            this.scene.sleep();
            this.scene.launch('MapViewScene', { gameState: this.gameState });
        });
    }
    
    onEnemiesCleared() {
        this.enemiesCleared = true;
        this.nextFloorButton.setVisible(true);
        this.nextFloorButtonText.setVisible(true);
        this.createFloatingText(320, 100, 'All enemies defeated!', 0x00ff00);
        this.createFloatingText(320, 120, 'Clear remaining cards or proceed.', 0xffffff);
    }
    
    gameWon() {
        this.add.rectangle(320, 180, 400, 150, 0x000000, 0.8).setOrigin(0.5);
        this.add.text(320, 140, 'VICTORY!', {
            fontSize: '28px',
            fill: '#ffd700',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        this.add.text(320, 180, `You have conquered the dungeon!`, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        const restartButton = this.add.rectangle(320, 220, 120, 30, 0x333333)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive()
            .on('pointerdown', () => this.scene.start('GameScene', {}));
        this.add.text(320, 220, 'Play Again', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
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
            const amuletSprite = this.add.image(x, y, amulet.sprite).setScale(0.4).setInteractive();
            this.amuletUIGroup.add(amuletSprite);
            
            // Add level indicator for stackable amulets
            if (amulet.level && amulet.level > 1) {
                const levelText = this.add.text(x + 8, y + 8, amulet.level.toString(), {
                    fontSize: '10px',
                    fill: '#ffffff',
                    fontFamily: '"Roboto Condensed"'
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
    
    updatePlayerEffectsUI() {
        this.playerEffectsUIGroup.clear(true, true);
        this.gameState.playerEffects.forEach((effect, i) => {
            const y = 190 + i * 15;
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
                fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"',
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
        }
        // Room state
        this.gameState.roomType = runData.room.type;
        this.gameState.roomInitialized = runData.room.initialized;
        this.gameState.activeRoomId = runData.room.activeId;
        this.roomType = this.gameState.roomType || this.roomType;
        this._activeRoomId = this.gameState.activeRoomId;
        // Re-apply relic effects on top of loaded state
        if (this.metaManager) {
            this.metaManager.applyRelicEffects(this.gameState);
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
        this.events.off('endPlayerTurn', this._handleEndPlayerTurn);
        this._turnHandlersBound = false;
    }
}
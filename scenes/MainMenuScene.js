// scenes/MainMenuScene.js
import { SaveManager } from '../SaveManager.js';
export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }
    
    create() {
        this.saveManager = new SaveManager();

        // Load saved settings
        this.loadSettings();

        // Background image (640×360, covers exactly the game canvas)
        if (this.textures.exists('mainBG')) {
            this.add.image(320, 180, 'mainBG');
        } else {
            this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
        }

        // Main menu buttons
        this.createMainMenuButtons();

        // Version text
        this.add.text(10, 350, 'v1.0.0', {
            fontSize: '12px',
            fill: '#888888',
            fontFamily: '"HoMM Pixel"'
        });
    }
    
    createMainMenuButtons() {
        const hasSavedRun = this.saveManager.hasCurrentRun();
        // 6px visible gap between buttons (29px tall + 6px = 35px center-to-center)
        this.createSpriteButton(320, 104, 'New Run',   () => this.startNewGame());
        this.createSpriteButton(320, 139, 'Continue',  hasSavedRun ? () => this.continueGame() : null);
        this.createSpriteButton(320, 174, 'Options',   () => this.showOptionsMenu());
        this.createSpriteButton(320, 209, 'Exit Game', () => this.exitGame());
    }

    // Sprite-based button using nextTurnUp (normal) / nextTurnDown (pressed).
    // Pass null for callback to render the button as disabled (greyed out).
    createSpriteButton(x, y, label, callback) {
        const disabled = !callback;

        // Drop shadow that matches the button's silhouette: a black-tinted
        // copy of the button image, offset straight down (no sideways shift)
        // for a clean "lifted off the page" look.
        const hasSprite = this.textures.exists('nextTurnUp') && this.textures.exists('nextTurnDown');
        let shadow;
        if (hasSprite) {
            shadow = this.add.image(x, y + 5, 'nextTurnUp').setOrigin(0.5)
                .setTint(0x000000)
                .setAlpha(disabled ? 0 : 0.7);
        } else {
            shadow = this.add.rectangle(x, y + 5, 90, 29, 0x000000, disabled ? 0 : 0.7).setOrigin(0.5);
        }
        let btn;
        if (hasSprite) {
            btn = this.add.image(x, y, 'nextTurnUp').setOrigin(0.5);
            if (disabled) btn.setAlpha(0.35);
        } else {
            btn = this.add.rectangle(x, y, 120, 29, disabled ? 0x444444 : 0x888888)
                .setStrokeStyle(1, 0xffffff);
        }

        const txt = this.add.text(x, y, label, {
            fontSize: '14px',
            fill: disabled ? '#888888' : '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        if (!disabled) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    // Lighten on hover
                    if (hasSprite) btn.setTint(0xdddddd);
                })
                .on('pointerout', () => {
                    btn.clearTint();
                    if (hasSprite) btn.setTexture('nextTurnUp');
                    txt.setY(y);
                })
                .on('pointerdown', () => {
                    if (hasSprite) btn.setTexture('nextTurnDown');
                    txt.setY(y + 1); // subtle press down
                })
                .on('pointerup', () => {
                    if (hasSprite) btn.setTexture('nextTurnUp');
                    txt.setY(y);
                    callback();
                });
        }

        return { button: btn, text: txt };
    }

    // Legacy rectangle button — still used by the Options / Reset dialogs.
    createButton(x, y, width, height, text, color, callback, disabled = false) {
        const button = this.add.rectangle(x, y, width, height, color, disabled ? 0.2 : 0.3)
            .setStrokeStyle(2, color);

        const buttonText = this.add.text(x, y, text, {
            fontSize: '18px',
            fill: disabled ? '#666666' : '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        if (!disabled) {
            button.setInteractive({ useHandCursor: true })
                .on('pointerover', () => button.setFillStyle(color, 0.5))
                .on('pointerout', () => button.setFillStyle(color, 0.3))
                .on('pointerdown', callback);
        }

        return { button, text: buttonText };
    }
    
    showOptionsMenu() {
        // Hide main menu buttons
        this.children.list.forEach(child => {
            if (child !== this.children.list[0]) { // Keep background
                child.setVisible(false);
            }
        });
        
        // Create options menu
        this.createOptionsMenu();
    }
    
    createOptionsMenu() {
        // Options container
        const optionsBg = this.add.rectangle(320, 180, 500, 320, 0x2c1810)
            .setStrokeStyle(3, 0xffffff);
        
        // Options title
        const optionsTitle = this.add.text(320, 60, 'OPTIONS', {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Language button
        const languageButton = this.createButton(320, 130, 300, 40, 
            `Language: ${this.getCurrentLanguage()}`, 0x00aaff, () => {
                this.cycleLanguage();
                languageButton.text.setText(`Language: ${this.getCurrentLanguage()}`);
            });
        
        // Music Volume
        this.createVolumeControl('Music Volume', 180);
        
        // Sound Effects Volume
        this.createVolumeControl('Sound Effects', 230);
        
        // Reset Progress button (wipes unlocked relics + saved run)
        const resetButton = this.createButton(320, 270, 220, 32, 'Reset All Progress', 0xff4444, () => {
            this.confirmResetProgress();
        });

        // Back button
        const backButton = this.createButton(320, 315, 150, 30, 'Back', 0x888888, () => {
            // Clean up options menu
            [optionsBg, optionsTitle,
             languageButton.button, languageButton.text,
             resetButton.button, resetButton.text,
             backButton.button, backButton.text]
                .forEach(item => item.destroy());
            
            // Destroy volume controls
            if (this.volumeControls) {
                this.volumeControls.forEach(control => {
                    Object.values(control).forEach(item => {
                        if (item && item.destroy) item.destroy();
                    });
                });
                this.volumeControls = [];
            }
            
            // Show main menu again
            this.children.list.forEach(child => child.setVisible(true));
        });
        
        // Store references for cleanup
        this.optionsElements = [optionsBg, optionsTitle, languageButton, backButton];
    }
    
    createVolumeControl(label, y) {
        if (!this.volumeControls) this.volumeControls = [];
        
        // Label
        const labelText = this.add.text(120, y, label + ':', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0, 0.5);
        
        // Slider background
        const sliderBg = this.add.rectangle(320, y, 200, 10, 0x333333)
            .setStrokeStyle(1, 0x666666);
        
        // Determine which volume to use
        const volumeType = label.includes('Music') ? 'music' : 'sfx';
        const currentVolume = this.game.globalVolume[volumeType];
        
        // Slider fill
        const sliderFill = this.add.rectangle(
            220, y, 
            200 * currentVolume, 10, 
            0x00ff00
        ).setOrigin(0, 0.5);
        
        // Slider handle
        const handle = this.add.circle(
            220 + (200 * currentVolume), 
            y, 8, 0xffffff
        ).setStrokeStyle(2, 0x000000)
        .setInteractive({ draggable: true, useHandCursor: true });
        
        // Volume text
        const volumeText = this.add.text(450, y, 
            Math.round(currentVolume * 100) + '%', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0, 0.5);
        
        // Handle dragging
        handle.on('drag', (pointer, dragX) => {
            handle.x = Phaser.Math.Clamp(dragX, 220, 420);
            const newVolume = (handle.x - 220) / 200;
            
            this.game.globalVolume[volumeType] = newVolume;
            sliderFill.width = 200 * newVolume;
            volumeText.setText(Math.round(newVolume * 100) + '%');
            
            this.saveSettings();
            
            // Play test sound for feedback
            if (volumeType === 'sfx' && newVolume > 0) {
                this.sound.play('coin_collect', { 
                    volume: this.game.globalVolume.master * newVolume * 0.3 
                });
            }
        });
        
        // Store controls for cleanup
        this.volumeControls.push({
            label: labelText,
            bg: sliderBg,
            fill: sliderFill,
            handle: handle,
            text: volumeText
        });
    }
    
    getCurrentLanguage() {
        if (!this.game.language) {
            this.game.language = 'English';
        }
        return this.game.language;
    }
    
    cycleLanguage() {
        const languages = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Chinese'];
        const currentIndex = languages.indexOf(this.game.language || 'English');
        const nextIndex = (currentIndex + 1) % languages.length;
        this.game.language = languages[nextIndex];
        this.saveSettings();
    }
    
    loadSettings() {
        // Load volume settings
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
        
        // Load language
        const savedLanguage = localStorage.getItem('gameLanguage');
        this.game.language = savedLanguage || 'English';
        
        // Apply volume
        this.sound.volume = this.game.globalVolume.master;
    }
    
    saveSettings() {
        localStorage.setItem('gameVolume', JSON.stringify(this.game.globalVolume));
        localStorage.setItem('gameLanguage', this.game.language);
    }
    
    startNewGame() {
        // Clear any existing run save
        this.saveManager.clearCurrentRun();
        
        // Start fresh run (meta progression is kept)
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { newGame: true });
        });
    }
    
    continueGame() {
        // Load the saved run
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { loadSave: true });
        });
    }
    
    confirmResetProgress() {
        const dimmer = this.add.rectangle(320, 180, 640, 360, 0x000000, 0.75);
        const box = this.add.rectangle(320, 180, 380, 170, 0x2c1810).setStrokeStyle(2, 0xff4444);
        const title = this.add.text(320, 130, 'Reset All Progress?', {
            fontSize: '20px', fill: '#ff8888', fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        const body = this.add.text(320, 170,
            'Wipes unlocked relics, stats, and\nany saved run. Settings are kept.', {
            fontSize: '13px', fill: '#ffffff', fontFamily: '"HoMM Pixel"', align: 'center'
        }).setOrigin(0.5);

        const cleanup = () => [dimmer, box, title, body,
            yes.button, yes.text, no.button, no.text].forEach(o => o.destroy());

        const yes = this.createButton(265, 230, 90, 30, 'Reset', 0xff4444, () => {
            this.saveManager.clearCurrentRun();
            this.saveManager.safeRemove(this.saveManager.META_SAVE_KEY);
            cleanup();
            // Rebuild main menu so Continue gets disabled, etc.
            this.scene.restart();
        });
        const no = this.createButton(375, 230, 90, 30, 'Cancel', 0x888888, () => cleanup());
    }

    exitGame() {
        // Show confirmation dialog
        const confirmBg = this.add.rectangle(320, 180, 300, 150, 0x000000, 0.9)
            .setStrokeStyle(2, 0xffffff);
        
        const confirmText = this.add.text(320, 150, 'Are you sure you want to exit?', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"',
            align: 'center'
        }).setOrigin(0.5);
        
        const yesButton = this.createButton(270, 200, 80, 30, 'Yes', 0x00ff00, () => {
            // If in browser, show a message
            if (window) {
                window.close(); // This might not work in all browsers
                // Fallback message
                this.add.text(320, 240, 'Please close this tab to exit', {
                    fontSize: '14px',
                    fill: '#ffff00',
                    fontFamily: '"HoMM Pixel"'
                }).setOrigin(0.5);
            }
        });
        
        const noButton = this.createButton(370, 200, 80, 30, 'No', 0xff0000, () => {
            [confirmBg, confirmText, yesButton.button, yesButton.text, 
             noButton.button, noButton.text].forEach(item => item.destroy());
        });
    }
}
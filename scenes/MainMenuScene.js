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
        
        // Background
        this.add.rectangle(320, 180, 640, 360, 0x1a1a1a);
        
        // Title
        this.add.text(320, 80, 'DUNGEON CARDS', {
            fontSize: '48px',
            fill: '#ffd700',
            fontFamily: '"Roboto Condensed"',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        // Subtitle
        this.add.text(320, 120, 'A Roguelike Card Adventure', {
            fontSize: '16px',
            fill: '#cccccc',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // Main menu buttons
        this.createMainMenuButtons();
        
        // Version text
        this.add.text(10, 350, 'v1.0.0', {
            fontSize: '12px',
            fill: '#666666',
            fontFamily: '"Roboto Condensed"'
        });
    }
    
    createMainMenuButtons() {
        // New Run button
        const newRunButton = this.createButton(320, 180, 200, 40, 'New Run', 0x00ff00, () => {
            this.startNewGame();
        });
        
        // Check if there's a current run to continue
        const hasSavedRun = this.saveManager.hasCurrentRun();
        
        // Continue button is enabled if there's a saved run
        const continueButton = this.createButton(320, 230, 200, 40, 'Continue', 
            hasSavedRun ? 0x00aaff : 0x666666, () => {
                if (hasSavedRun) this.continueGame();
            }, !hasSavedRun);
        
        // Options button
        const optionsButton = this.createButton(320, 280, 200, 40, 'Options', 0xffaa00, () => {
            this.showOptionsMenu();
        });
        
        // Exit button
        const exitButton = this.createButton(320, 330, 200, 40, 'Exit Game', 0xff6666, () => {
            this.exitGame();
        });
    }
    
    createButton(x, y, width, height, text, color, callback, disabled = false) {
        const button = this.add.rectangle(x, y, width, height, color, disabled ? 0.2 : 0.3)
            .setStrokeStyle(2, color);
        
        const buttonText = this.add.text(x, y, text, {
            fontSize: '18px',
            fill: disabled ? '#666666' : '#ffffff',
            fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"'
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
        
        // Back button
        const backButton = this.createButton(320, 300, 150, 35, 'Back', 0x888888, () => {
            // Clean up options menu
            [optionsBg, optionsTitle, languageButton.button, languageButton.text, backButton.button, backButton.text]
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
            fontFamily: '"Roboto Condensed"'
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
            fontFamily: '"Roboto Condensed"'
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
    
    exitGame() {
        // Show confirmation dialog
        const confirmBg = this.add.rectangle(320, 180, 300, 150, 0x000000, 0.9)
            .setStrokeStyle(2, 0xffffff);
        
        const confirmText = this.add.text(320, 150, 'Are you sure you want to exit?', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"',
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
                    fontFamily: '"Roboto Condensed"'
                }).setOrigin(0.5);
            }
        });
        
        const noButton = this.createButton(370, 200, 80, 30, 'No', 0xff0000, () => {
            [confirmBg, confirmText, yesButton.button, yesButton.text, 
             noButton.button, noButton.text].forEach(item => item.destroy());
        });
    }
}
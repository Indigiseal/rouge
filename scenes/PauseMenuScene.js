// scenes/PauseMenuScene.js

import { SaveManager } from '../SaveManager.js';

export class PauseMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseMenuScene' });
    }
    
    init(data) {
        this.pausedScene = data.pausedScene || 'GameScene';
        this.saveManager = new SaveManager();

        // Initialize volume settings if they don't exist
        if (!this.game.globalVolume) {
            this.game.globalVolume = {
                master: 1.0,
                sfx: 1.0,
                music: 0.5
            };
        }
    }
    
    create() {
        // Semi-transparent black overlay
        this.overlay = this.add.rectangle(320, 180, 640, 360, 0x000000, 0.7);
        
        // Menu container background
        const menuBg = this.add.rectangle(320, 180, 400, 280, 0x2c1810)
            .setStrokeStyle(3, 0xffffff);
        
        // Title
        this.add.text(320, 80, 'PAUSED', {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // Sound settings title
        this.add.text(320, 120, 'Sound Settings', {
            fontSize: '18px',
            fill: '#cccccc',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // Sound Effects Volume
        this.createVolumeSlider('Sound Effects', 170, 'sfx');

        // Music Volume (for future use)
        this.createVolumeSlider('Music', 210, 'music');
        
        // Resume button
        const resumeButton = this.add.rectangle(230, 280, 120, 35, 0x00ff00, 0.3)
            .setStrokeStyle(2, 0x00ff00)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => resumeButton.setFillStyle(0x00ff00, 0.5))
            .on('pointerout', () => resumeButton.setFillStyle(0x00ff00, 0.3))
            .on('pointerdown', () => this.resumeGame());
        
        this.add.text(230, 280, 'Resume', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0.5);
        
        // ESC key to resume
        this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    }
    
    createVolumeSlider(label, y, volumeType) {
        // Label
        this.add.text(180, y, label + ':', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(1, 0.5);
        
        // Slider background
        const sliderBg = this.add.rectangle(320, y, 200, 10, 0x333333)
            .setStrokeStyle(1, 0x666666);
        
        // Slider fill
        const sliderFill = this.add.rectangle(
            220, y, 
            200 * this.game.globalVolume[volumeType], 10, 
            0x00ff00
        ).setOrigin(0, 0.5);
        
        // Slider handle
        const handle = this.add.circle(
            220 + (200 * this.game.globalVolume[volumeType]), 
            y, 8, 0xffffff
        ).setStrokeStyle(2, 0x000000)
        .setInteractive({ draggable: true, useHandCursor: true });
        
        // Volume percentage text
        const volumeText = this.add.text(440, y, 
            Math.round(this.game.globalVolume[volumeType] * 100) + '%', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"Roboto Condensed"'
        }).setOrigin(0, 0.5);
        
        // Make slider interactive
        const sliderZone = this.add.zone(320, y, 200, 30)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer) => {
                const localX = pointer.x - 220;
                const newVolume = Phaser.Math.Clamp(localX / 200, 0, 1);
                this.updateVolume(volumeType, newVolume, handle, sliderFill, volumeText);
            });
        
        // Handle dragging
        handle.on('drag', (pointer, dragX) => {
            const newVolume = Phaser.Math.Clamp((dragX - 220) / 200, 0, 1);
            this.updateVolume(volumeType, newVolume, handle, sliderFill, volumeText);
        });
        
        // Constrain handle dragging
        this.input.setDraggable(handle);
        handle.on('drag', (pointer, dragX, dragY) => {
            handle.x = Phaser.Math.Clamp(dragX, 220, 420);
            handle.y = y; // Keep Y position fixed
            
            const newVolume = (handle.x - 220) / 200;
            this.updateVolume(volumeType, newVolume, handle, sliderFill, volumeText);
        });
    }
    
    updateVolume(volumeType, newVolume, handle, sliderFill, volumeText) {
        this.game.globalVolume[volumeType] = newVolume;
        
        // Update visual elements
        handle.x = 220 + (200 * newVolume);
        sliderFill.width = 200 * newVolume;
        volumeText.setText(Math.round(newVolume * 100) + '%');
        
        // Apply volume changes to the game
        this.applyVolumeSettings();
        
        // Play a test sound for feedback (except for music)
        if (volumeType !== 'music' && newVolume > 0) {
            this.sound.play('coin_collect', { 
                volume: this.game.globalVolume.master * this.game.globalVolume.sfx * 0.3 
            });
        }
    }
    
    applyVolumeSettings() {
        // Update the global sound manager volume
        this.sound.volume = this.game.globalVolume.master;

        this.saveManager.saveSettings({
            volume: this.game.globalVolume,
            language: this.game.language || 'English',
        });
    }
    
    resumeGame() {
        // Resume the paused scene
        this.scene.resume(this.pausedScene);
        this.scene.stop();
    }
    
}

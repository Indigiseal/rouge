// scenes/PauseMenuScene.js
import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { loadVolumeSettings, saveVolumeSettings } from '../audio/VolumeSettings.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { humanRunRecorder } from '../systems/HumanRunRecorder.js';
import { t } from '../i18n/i18n.js';

export class PauseMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PauseMenuScene' });
    }
    
    init(data) {
        this.pausedScene = data.pausedScene || 'GameScene';
        this.game.globalVolume = loadVolumeSettings();
        saveVolumeSettings(this.game.globalVolume);
    }
    
    create() {
        // Semi-transparent black overlay
        this.overlay = this.add.rectangle(320, 180, 640, 360, 0x000000, 0.7);
        
        // Menu container background
        const menuBg = this.add.rectangle(320, 180, 440, 338, 0x2c1810)
            .setStrokeStyle(3, 0xffffff);
        
        // Title
        this.add.text(320, 35, t(this, 'ui.pause.title'), {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Sound settings title
        this.add.text(320, 72, t(this, 'ui.pause.soundSettings'), {
            fontSize: '18px',
            fill: '#cccccc',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        this.createVolumeSlider(t(this, 'ui.options.musicVolume'), 112, 'music');
        this.createVolumeSlider(t(this, 'ui.options.soundEffects'), 152, 'sfx');
        
        // Resume button
        const resumeButton = this.add.rectangle(230, 205, 120, 35, 0x00ff00, 0.3)
            .setStrokeStyle(2, 0x00ff00)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => { SoundHelper.playVariant(this, 'hover_button', 0.4); resumeButton.setFillStyle(0x00ff00, 0.5); })
            .on('pointerout', () => resumeButton.setFillStyle(0x00ff00, 0.3))
            .on('pointerdown', () => this.resumeGame());
        
        this.add.text(230, 205, t(this, 'ui.pause.resume'), {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);
        
        // Main Menu button (optional - for future use)
        const mainMenuButton = this.add.rectangle(410, 205, 120, 35, 0xff6666, 0.3)
            .setStrokeStyle(2, 0xff6666)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => { SoundHelper.playVariant(this, 'hover_button', 0.4); mainMenuButton.setFillStyle(0xff6666, 0.5); })
            .on('pointerout', () => mainMenuButton.setFillStyle(0xff6666, 0.3))
            .on('pointerdown', () => this.quitToMainMenu());
        
        this.add.text(410, 205, t(this, 'ui.pause.saveQuit'), {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.createRecorderControls();
        
        // ESC key to resume
        this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    }

    createRecorderControls() {
        this.recorderStatusText = this.add.text(320, 253, '', {
            fontSize: '13px',
            fill: '#d7c9a8',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        const toggleButton = this.add.rectangle(245, 305, 145, 35, 0x6c63ff, 0.32)
            .setStrokeStyle(2, 0x8c86ff)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => toggleButton.setFillStyle(0x6c63ff, 0.52))
            .on('pointerout', () => toggleButton.setFillStyle(0x6c63ff, 0.32))
            .on('pointerdown', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                humanRunRecorder.toggle(this.getRecordingScene());
                this.refreshRecorderControls();
            });

        this.recorderToggleText = this.add.text(245, 305, '', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        const exportButton = this.add.rectangle(395, 305, 125, 35, 0x4caf50, 0.28)
            .setStrokeStyle(2, 0x65c66a)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => exportButton.setFillStyle(0x4caf50, 0.48))
            .on('pointerout', () => exportButton.setFillStyle(0x4caf50, 0.28))
            .on('pointerdown', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                const result = humanRunRecorder.download();
                if (!result.ok && result.reason === 'no_trace') {
                    this.recorderStatusText.setText(t(this, 'ui.pause.noRecordedRun'));
                } else if (!result.ok) {
                    this.recorderStatusText.setText(t(this, 'ui.pause.exportUnavailable'));
                }
            });

        this.add.text(395, 305, t(this, 'ui.pause.exportJson'), {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0.5);

        this.refreshRecorderControls();
    }

    getRecordingScene() {
        try {
            return this.scene.get('GameScene') || this.scene.get(this.pausedScene) || this;
        } catch {
            return this;
        }
    }

    refreshRecorderControls() {
        const status = humanRunRecorder.getStatus();
        this.recorderToggleText?.setText(status.active ? t(this, 'ui.pause.stopRecording') : t(this, 'ui.pause.record'));
        if (status.storageError) {
            this.recorderStatusText?.setText(t(this, 'ui.pause.recorderMemory', { amount: status.eventCount }));
        } else if (status.active) {
            this.recorderStatusText?.setText(t(this, 'ui.pause.recorderOn', { amount: status.eventCount }));
        } else if (status.eventCount > 0) {
            this.recorderStatusText?.setText(t(this, 'ui.pause.recorderReady', { amount: status.eventCount }));
        } else {
            this.recorderStatusText?.setText(t(this, 'ui.pause.recorderOff'));
        }
    }
    
    createVolumeSlider(label, y, volumeType) {
        // Label
        this.add.text(180, y, label + ':', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel"'
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
            fontFamily: '"HoMM Pixel"'
        }).setOrigin(0, 0.5);
        
        // Make slider interactive
        const sliderZone = this.add.zone(320, y, 200, 30)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer) => {
                const localX = pointer.worldX - 220;
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
        if (volumeType === 'music') MusicManager.updateCurrentVolume(this);
        
        // Play a test sound for feedback (except for music)
        if (volumeType !== 'music' && newVolume > 0) {
            SoundHelper.playSound(this, 'coin_collect', 0.3);
        }
    }
    
    applyVolumeSettings() {
        // Update the global sound manager volume
        this.sound.volume = this.game.globalVolume.master;
        
        // Store in localStorage for persistence
        saveVolumeSettings(this.game.globalVolume);
    }
    
    resumeGame() {
        // Resume the paused scene
        this.scene.resume(this.pausedScene);
        this.scene.stop();
    }
    
    quitToMainMenu() {
        // Save the current run so it can be resumed from the main menu. The load
        // side treats a save taken in a shop/rest/etc. as "resume on the map", so
        // quitting from a station room comes back cleanly.
        const gameScene = this.scene.get(this.pausedScene);
        if (isSandboxMode(gameScene) || isSandboxMode(this)) {
            exitToSandboxHub(this);
            return;
        }

        if (gameScene && typeof gameScene.saveCurrentRun === 'function') {
            gameScene.saveCurrentRun();
        }

        // Stop active gameplay scenes, then go to the main menu. Include the
        // station scenes: pausing is now possible from a shop, and leaving one
        // running would leak its board over the main menu.
        this.scene.stop(this.pausedScene);
        this.scene.stop('MapViewScene');
        ['ShopScene', 'RareShopScene', 'RestScene', 'AnvilScene', 'TreasureScene', 'EventScene']
            .forEach(key => this.scene.stop(key));
        this.scene.stop();
        this.scene.start('MainMenuScene');
    }
}

// scenes/MainMenuScene.js
import { SaveManager } from '../SaveManager.js';
import { getLanguageName, getLanguageOptions, normalizeLanguageCode, t } from '../utils/i18n.js';
import { MusicManager } from '../utils/MusicManager.js';
import { SoundHelper } from '../utils/SoundHelper.js';
import { loadVolumeSettings, saveVolumeSettings } from '../utils/VolumeSettings.js';
export class MainMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainMenuScene' });
    }
    
    create() {
        this.saveManager = new SaveManager();
        this.activeModal = null;

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
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        });

        MusicManager.play(this, 'menu_music', 0.6, 900);
    }

    // Fade the menu theme out over the same span as the camera fade before we
    // hand off to gameplay.
    fadeOutMenuMusic() {
        MusicManager.stopIfPlaying(this, 'menu_music', 450);
    }
    
    createMainMenuButtons() {
        const hasSavedRun = this.saveManager.hasCurrentRun();
        // 6px visible gap between buttons (29px tall + 6px = 35px center-to-center)
        this.mainMenuButtons = {
            newRun: this.createSpriteButton(320, 104, t(this, 'ui.menu.newRun'),   () => this.startNewGame()),
            continue: this.createSpriteButton(320, 139, t(this, 'ui.menu.continue'),  hasSavedRun ? () => this.continueGame() : null),
            options: this.createSpriteButton(320, 174, t(this, 'ui.menu.options'),   () => this.showOptionsMenu()),
            tutorial: this.createSpriteButton(320, 209, 'Tutorial',                 () => this.startTutorial()),
        };
    }

    refreshMainMenuText() {
        if (!this.mainMenuButtons) return;
        this.mainMenuButtons.newRun.text.setText(t(this, 'ui.menu.newRun'));
        this.mainMenuButtons.continue.text.setText(t(this, 'ui.menu.continue'));
        this.mainMenuButtons.options.text.setText(t(this, 'ui.menu.options'));
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
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        if (!disabled) {
            btn.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    SoundHelper.playSound(this, 'hover_soft', 0.4);
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
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        if (!disabled) {
            button.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    SoundHelper.playSound(this, 'hover_soft', 0.4);
                    button.setFillStyle(color, 0.5);
                })
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
                // Visibility does not reliably remove a Phaser Game Object from
                // input hit testing. Keep hidden menu buttons from receiving
                // clicks through the options/reset dialogs.
                if (child.input) child.disableInteractive();
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
        const optionsTitle = this.add.text(320, 60, t(this, 'ui.options.title'), {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
        
        // Language button
        const languageButton = this.createButton(320, 130, 300, 40, 
            t(this, 'ui.options.language', { language: this.getCurrentLanguage() }), 0x00aaff, () => {
                this.cycleLanguage();
                this.refreshOptionsMenuText({ optionsTitle, languageButton, resetButton, backButton });
            });
        
        // Music Volume
        this.createVolumeControl(t(this, 'ui.options.musicVolume'), 180, 'music');
        
        // Sound Effects Volume
        this.createVolumeControl(t(this, 'ui.options.soundEffects'), 230, 'sfx');
        
        // Reset Progress button (wipes unlocked relics + saved run)
        const resetButton = this.createButton(320, 270, 220, 32, t(this, 'ui.options.resetAll'), 0xff4444, () => {
            this.confirmResetProgress();
        });

        // Back button
        const backButton = this.createButton(320, 315, 150, 30, t(this, 'ui.options.back'), 0x888888, () => {
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
            Object.values(this.mainMenuButtons || {}).forEach(entry => {
                if (entry?.button?.input) entry.button.input.enabled = true;
            });
        });
        
        // Store references for cleanup
        this.optionsElements = [optionsBg, optionsTitle, languageButton, backButton];
    }

    refreshOptionsMenuText({ optionsTitle, languageButton, resetButton, backButton }) {
        optionsTitle.setText(t(this, 'ui.options.title'));
        languageButton.text.setText(t(this, 'ui.options.language', { language: this.getCurrentLanguage() }));
        resetButton.text.setText(t(this, 'ui.options.resetAll'));
        backButton.text.setText(t(this, 'ui.options.back'));

        if (this.volumeControls) {
            this.volumeControls.forEach(control => {
                if (control.type === 'music') {
                    control.label.setText(`${t(this, 'ui.options.musicVolume')}:`);
                } else if (control.type === 'sfx') {
                    control.label.setText(`${t(this, 'ui.options.soundEffects')}:`);
                }
            });
        }
    }
    
    createVolumeControl(label, y, volumeType) {
        if (!this.volumeControls) this.volumeControls = [];
        
        // Label
        const labelText = this.add.text(120, y, label + ':', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0, 0.5);
        
        // Slider background
        const sliderBg = this.add.rectangle(320, y, 200, 10, 0x333333)
            .setStrokeStyle(1, 0x666666);
        
        // Determine which volume to use
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
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0, 0.5);
        
        // Handle dragging
        handle.on('drag', (pointer, dragX) => {
            handle.x = Phaser.Math.Clamp(dragX, 220, 420);
            const newVolume = (handle.x - 220) / 200;
            
            this.game.globalVolume[volumeType] = newVolume;
            sliderFill.width = 200 * newVolume;
            volumeText.setText(Math.round(newVolume * 100) + '%');
            
            this.saveSettings();
            if (volumeType === 'music') MusicManager.updateCurrentVolume(this);
            
            // Play test sound for feedback
            if (volumeType === 'sfx' && newVolume > 0) {
                SoundHelper.playSound(this, 'coin_collect', 0.3);
            }
        });
        
        // Store controls for cleanup
        this.volumeControls.push({
            type: volumeType,
            label: labelText,
            bg: sliderBg,
            fill: sliderFill,
            handle: handle,
            text: volumeText
        });
    }
    
    getCurrentLanguage() {
        this.game.language = normalizeLanguageCode(this.game.language);
        return getLanguageName(this.game.language);
    }
    
    cycleLanguage() {
        // Guard against a single click firing twice. pointerdown can be dispatched
        // twice for one tap on some input setups (touch + mouse emulation); with only
        // two languages a double-fire cycles en->ru->en and looks like the toggle did
        // nothing — which is exactly the "sometimes it switches, sometimes not" bug.
        const now = Date.now();
        if (this._lastLangCycle && now - this._lastLangCycle < 250) return;
        this._lastLangCycle = now;

        const languages = getLanguageOptions().map(option => option.code);
        const currentIndex = languages.indexOf(normalizeLanguageCode(this.game.language));
        const nextIndex = (currentIndex + 1) % languages.length;
        this.game.language = languages[nextIndex];
        this.saveSettings();
        this.refreshMainMenuText();
    }
    
    loadSettings() {
        this.game.globalVolume = loadVolumeSettings();
        saveVolumeSettings(this.game.globalVolume);
        
        // Load language
        const savedLanguage = localStorage.getItem('gameLanguage');
        this.game.language = normalizeLanguageCode(savedLanguage);
        
        // Apply volume
        this.sound.volume = this.game.globalVolume.master;
    }
    
    saveSettings() {
        saveVolumeSettings(this.game.globalVolume);
        localStorage.setItem('gameLanguage', this.game.language);
    }
    
    startNewGame() {
        // Clear any existing run save
        this.saveManager.clearCurrentRun();

        this.fadeOutMenuMusic();
        // Start fresh run (meta progression is kept)
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { newGame: true });
        });
    }
    
    continueGame() {
        this.fadeOutMenuMusic();
        // Load the saved run
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { loadSave: true });
        });
    }

    startTutorial() {
        this.fadeOutMenuMusic();
        // Launch the guided, rigged tutorial floor. Does not touch the saved run.
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('GameScene', { tutorial: true });
        });
    }
    
    confirmResetProgress() {
        if (this.activeModal) return;

        // The full-screen interactive dimmer consumes input outside the dialog,
        // preventing clicks from falling through to hidden menu controls.
        const dimmer = this.add.rectangle(320, 180, 640, 360, 0x000000, 0.75)
            .setDepth(1000)
            .setInteractive();
        const box = this.add.rectangle(320, 180, 380, 170, 0x2c1810)
            .setStrokeStyle(2, 0xff4444)
            .setDepth(1001);
        const title = this.add.text(320, 130, t(this, 'ui.options.resetTitle'), {
            fontSize: '20px', fill: '#ff8888', fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setDepth(1002);
        const body = this.add.text(320, 170,
            t(this, 'ui.options.resetBody'), {
            fontSize: '13px', fill: '#ffffff', fontFamily: '"HoMM Pixel", Arial, sans-serif', align: 'center'
        }).setOrigin(0.5).setDepth(1002);

        let closed = false;
        const cleanup = () => {
            if (closed) return;
            closed = true;
            [dimmer, box, title, body, yes.button, yes.text, no.button, no.text]
                .forEach(o => o?.destroy());
            this.activeModal = null;
        };

        const yes = this.createButton(265, 230, 90, 30, t(this, 'ui.options.reset'), 0xff4444, () => {
            this.saveManager.clearCurrentRun();
            this.saveManager.safeRemove(this.saveManager.META_SAVE_KEY);
            this.saveManager.safeRemove('heroMemory');
            this.saveManager.safeRemove('storyProgress');
            cleanup();
            // Restart on the next game tick so the click that confirmed the
            // reset cannot also activate a button in the rebuilt main menu.
            this.time.delayedCall(0, () => this.scene.restart());
        });
        const no = this.createButton(375, 230, 90, 30, t(this, 'ui.options.cancel'), 0x888888, () => cleanup());
        [yes.button, yes.text, no.button, no.text].forEach(o => o.setDepth(1002));
        this.activeModal = { type: 'reset', cleanup };
    }

}

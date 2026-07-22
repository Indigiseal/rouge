// scenes/MainMenuScene.js
import { SaveManager } from '../SaveManager.js';
import { getLanguageName, getLanguageOptions, normalizeLanguageCode, t } from '../utils/i18n.js';
import {
    attachTestOptionsToGame,
    invalidateTestOptionsCache,
    isTestOptionEnabled,
    setTestOption,
    TEST_OPTION_DEFS,
} from '../utils/TestOptions.js';
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
        // 6px visible gap between buttons (29px tall + 6px = 35px center-to-center).
        // Options moved out to the cog in the corner, so the three that remain
        // re-center on the same spot the old four-button stack occupied (156).
        this.mainMenuButtons = {
            newRun: this.createSpriteButton(320, 110, t(this, 'ui.menu.newRun'),   () => this.startNewGame()),
            continue: this.createSpriteButton(320, 142, t(this, 'ui.menu.continue'),  hasSavedRun ? () => this.continueGame() : null),
            tutorial: this.createSpriteButton(320, 174, 'Tutorial',                 () => this.startTutorial()),
            testPolygon: this.createSpriteButton(320, 206, 'Test Polygon',          () => this.startTestPolygon()),
            testOptions: this.createSpriteButton(320, 238, t(this, 'ui.menu.testOptions'), () => this.showTestOptionsMenu()),
            // Cog tucked into the top-right corner (32x32, 6px margin).
            options: this.createIconButton(618, 22, 'optionsButton', () => this.showOptionsMenu()),
        };
    }

    refreshMainMenuText() {
        if (!this.mainMenuButtons) return;
        this.mainMenuButtons.newRun.text.setText(t(this, 'ui.menu.newRun'));
        this.mainMenuButtons.continue.text.setText(t(this, 'ui.menu.continue'));
        // Options is the cog icon now — a glyph, nothing to translate.
        if (this.mainMenuButtons.testOptions) {
            this.mainMenuButtons.testOptions.text.setText(t(this, 'ui.menu.testOptions'));
        }
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
                    SoundHelper.playVariant(this, 'hover_button', 0.4);
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

    // Icon-only variant of createSpriteButton for a 2-frame up/down skin
    // (frame 0 = up, frame 1 = pressed). Carries the same shadow, hover sound,
    // hover lighten and press swap as the text buttons — the art is a different
    // skin, not different behaviour. The glyph is the label, so there's no text.
    createIconButton(x, y, sheet, callback) {
        // Options is the only way to reach language, volume and reset, so it must
        // exist even if the skin fails to load — same fallback habit as
        // createSpriteButton, with a cog glyph standing in for the art.
        const hasSprite = this.textures.exists(sheet);

        // Same silhouette shadow as the text buttons: a black-tinted copy of the
        // resting frame, offset straight down.
        const shadow = hasSprite
            ? this.add.image(x, y + 5, sheet, 0).setOrigin(0.5).setTint(0x000000).setAlpha(0.7)
            : this.add.rectangle(x, y + 5, 32, 32, 0x000000, 0.7).setOrigin(0.5);

        const btn = hasSprite
            ? this.add.image(x, y, sheet, 0).setOrigin(0.5)
            : this.add.rectangle(x, y, 32, 32, 0x888888).setStrokeStyle(1, 0xffffff).setOrigin(0.5);

        const glyph = hasSprite ? null : this.add.text(x, y, '⚙', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        btn.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                if (hasSprite) btn.setTint(0xdddddd);
            })
            .on('pointerout', () => {
                if (hasSprite) { btn.clearTint(); btn.setFrame(0); }
                glyph?.setY(y);
            })
            .on('pointerdown', () => {
                if (hasSprite) btn.setFrame(1);
                glyph?.setY(y + 1);
            })
            .on('pointerup', () => {
                if (hasSprite) btn.setFrame(0);
                glyph?.setY(y);
                callback();
            });

        return { button: btn, shadow, text: glyph };
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
                    SoundHelper.playVariant(this, 'hover_button', 0.4);
                    button.setFillStyle(color, 0.5);
                })
                .on('pointerout', () => button.setFillStyle(color, 0.3))
                .on('pointerdown', callback);
        }

        return { button, text: buttonText };
    }
    
    showTestOptionsMenu() {
        this.children.list.forEach(child => {
            if (child !== this.children.list[0]) {
                child.setVisible(false);
                if (child.input) child.disableInteractive();
            }
        });
        this.createTestOptionsMenu();
    }

    createTestOptionsMenu() {
        const elements = [];
        const optionRows = [];

        const panel = this.add.rectangle(320, 180, 520, 300, 0x2c1810)
            .setStrokeStyle(3, 0xffffff);
        elements.push(panel);

        const title = this.add.text(320, 45, t(this, 'ui.testOptions.title'), {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
        elements.push(title);

        const subtitle = this.add.text(320, 68, t(this, 'ui.testOptions.subtitle'), {
            fontSize: '11px',
            fill: '#bbbbbb',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            align: 'center'
        }).setOrigin(0.5);
        elements.push(subtitle);

        TEST_OPTION_DEFS.forEach((def, index) => {
            const y = 110 + index * 72;
            const rowBg = this.add.rectangle(320, y + 8, 470, 58, 0x1a120c)
                .setStrokeStyle(1, 0x666666);
            elements.push(rowBg);

            const label = this.add.text(70, y - 6, t(this, def.labelKey), {
                fontSize: '14px',
                fill: '#ffffff',
                fontFamily: '"HoMM Pixel", Arial, sans-serif'
            }).setOrigin(0, 0.5);
            elements.push(label);

            const description = this.add.text(70, y + 12, t(this, def.descriptionKey), {
                fontSize: '10px',
                fill: '#aaaaaa',
                fontFamily: '"HoMM Pixel", Arial, sans-serif',
                wordWrap: { width: 330 }
            }).setOrigin(0, 0.5);
            elements.push(description);

            const toggle = this.createToggleButton(500, y + 8, def.id, () => {
                this.refreshTestOptionsMenu(optionRows);
            });
            elements.push(toggle.button, toggle.text);
            optionRows.push({ def, toggle });
        });

        const backButton = this.createButton(320, 305, 150, 30, t(this, 'ui.testOptions.back'), 0x888888, () => {
            elements.forEach(item => item?.destroy?.());
            this.children.list.forEach(child => child.setVisible(true));
            Object.values(this.mainMenuButtons || {}).forEach(entry => {
                if (entry?.button?.input) entry.button.input.enabled = true;
            });
        });
        elements.push(backButton.button, backButton.text);
    }

    createToggleButton(x, y, optionId, onChange) {
        const enabled = isTestOptionEnabled(optionId);
        const color = enabled ? 0x228822 : 0x664444;
        const button = this.add.rectangle(x, y, 72, 28, color, 0.85)
            .setStrokeStyle(2, enabled ? 0x66ff66 : 0xff6666)
            .setInteractive({ useHandCursor: true });

        const text = this.add.text(x, y, enabled ? t(this, 'ui.testOptions.on') : t(this, 'ui.testOptions.off'), {
            fontSize: '13px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);

        button.on('pointerdown', () => {
            const next = !isTestOptionEnabled(optionId);
            setTestOption(optionId, next);
            invalidateTestOptionsCache();
            onChange?.();
            const on = isTestOptionEnabled(optionId);
            button.setFillStyle(on ? 0x228822 : 0x664444, 0.85);
            button.setStrokeStyle(2, on ? 0x66ff66 : 0xff6666);
            text.setText(on ? t(this, 'ui.testOptions.on') : t(this, 'ui.testOptions.off'));
        });

        return { button, text, optionId };
    }

    refreshTestOptionsMenu(optionRows) {
        optionRows.forEach(({ def, toggle }) => {
            const on = isTestOptionEnabled(def.id);
            toggle.button.setFillStyle(on ? 0x228822 : 0x664444, 0.85);
            toggle.button.setStrokeStyle(2, on ? 0x66ff66 : 0xff6666);
            toggle.text.setText(on ? t(this, 'ui.testOptions.on') : t(this, 'ui.testOptions.off'));
        });
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
        
        // Reset Progress button (wipes character XP/talents + saved run)
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

        // Move the slider to a target volume (0..1) and apply it. Shared by both
        // dragging the handle and clicking anywhere on the track.
        const applyVolume = (newVolume) => {
            newVolume = Phaser.Math.Clamp(newVolume, 0, 1);
            handle.x = 220 + (200 * newVolume);
            this.game.globalVolume[volumeType] = newVolume;
            sliderFill.width = 200 * newVolume;
            volumeText.setText(Math.round(newVolume * 100) + '%');

            this.saveSettings();
            if (volumeType === 'music') MusicManager.updateCurrentVolume(this);

            // Play test sound for feedback
            if (volumeType === 'sfx' && newVolume > 0) {
                SoundHelper.playSound(this, 'coin_collect', 0.3);
            }
        };

        // Click (or drag) anywhere on the track to jump the slider there — not
        // just a slow drag of the handle. The zone spans the full 200px track.
        const sliderZone = this.add.zone(320, y, 200, 30)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer) => applyVolume((pointer.x - 220) / 200));
        // Keep the handle above the zone so grabbing it still starts a drag.
        this.children.bringToTop(handle);

        // Handle dragging
        handle.on('drag', (pointer, dragX) => applyVolume((dragX - 220) / 200));

        // Store controls for cleanup
        this.volumeControls.push({
            type: volumeType,
            label: labelText,
            bg: sliderBg,
            fill: sliderFill,
            handle: handle,
            text: volumeText,
            zone: sliderZone
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

        attachTestOptionsToGame(this.game);
        
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
        // Character pick once, then floor 1
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('CharacterSelectScene');
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

    startTestPolygon() {
        this.fadeOutMenuMusic();
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('SandboxHubScene');
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

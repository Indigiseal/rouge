// scenes/MainMenuScene.js
import {
    OptionsSkin,
    OPTIONS_BACKDROP,
    OPTIONS_INK,
    OPTIONS_PANEL_H,
    OPTIONS_PANEL_W,
    OPTIONS_RESET_INK,
    RESET_LABEL_OFFSET_X,
    UI_BUTTON,
    UI_BUTTON_W,
} from '../ui/OptionsSkin.js';
import { SaveManager } from '../managers/SaveManager.js';
import { getLanguageName, getLanguageOptions, normalizeLanguageCode, t } from '../i18n/i18n.js';
import {
    attachTestOptionsToGame,
    invalidateTestOptionsCache,
    isTestOptionEnabled,
    setTestOption,
    TEST_OPTION_DEFS,
} from '../config/TestOptions.js';
import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { loadVolumeSettings, saveVolumeSettings } from '../audio/VolumeSettings.js';
import { openConfirmModal } from '../ui/ConfirmModal.js';
import { FONT_SIZE, fitLabel, serifStyle } from '../ui/uiFont.js';

// --- Options screen skin -----------------------------------------------------
// Plates, panel size, palette and label offsets all come from ui/OptionsSkin.js,
// which the pause screen wears too. Only this screen's own geometry lives here.
// Reset sits in the screen's bottom-right corner, off the paper entirely.
const SCREEN_MARGIN = 8;
// The language plate is drawn in the top 26px of its 32px cell, so its label
// needs lifting to sit on the plate rather than on the cell's centre line.
const LANGUAGE_LABEL_OFFSET_Y = -3;
// Main-menu plates are 90x30 with ~82px of usable label room.
const MENU_LABEL_PX = '14px';
const MENU_PLATE_LABEL_W = 82;

// Options-screen type sizes come from the shared scale in ui/uiFont.js so the
// heading here and the headings on every other screen cannot drift apart.
const SERIF_BODY_PX = FONT_SIZE.body;
const SERIF_TITLE_PX = FONT_SIZE.heading;

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
        this.showClickToPlayIfMuted();
    }

    // Browsers refuse to start audio until the player has interacted with the
    // page, so on a first visit the menu theme is queued rather than played.
    // This gives that interaction somewhere obvious to happen.
    //
    // It only appears when audio is ACTUALLY blocked. Once a browser trusts the
    // origin — which it does after a session or two — audioNeedsGesture is
    // false, nothing is drawn, and the menu opens straight into music.
    showClickToPlayIfMuted() {
        if (!SoundHelper.audioNeedsGesture(this)) return;

        const veil = this.add.rectangle(320, 180, 640, 360, 0x0e0b10, 0.82)
            .setDepth(9000)
            .setInteractive({ useHandCursor: true });
        const label = this.add.text(320, 180, t(this, 'ui.menu.clickToPlay'), {
            fontSize: '20px',
            fill: '#f5e6c8',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
        }).setOrigin(0.5).setDepth(9001);

        let dismissed = false;
        const dismiss = () => {
            if (dismissed) return;
            dismissed = true;
            // Stop taking input at once, but keep the veil in the display list
            // until the next tick.
            //
            // The menu buttons fire their callback on POINTERUP. Tearing the
            // veil down inside a pointerdown handler removed the topmost
            // interactive object mid-gesture, so the release landed on whatever
            // button was underneath and started a run. Dismissing on pointerup
            // and outliving the event by a tick means the veil absorbs the
            // whole click.
            veil.disableInteractive();
            this.time.delayedCall(0, () => {
                veil.destroy();
                label.destroy();
            });
            // The menu track may still be downloading at the moment of the
            // click. Resume Web Audio, then explicitly preserve/start its
            // request so the deferred track begins as soon as it is available.
            SoundHelper.resumeAudio(this)
                .catch(() => {})
                .finally(() => MusicManager.play(this, 'menu_music', 0.6, 900));
        };
        veil.once('pointerup', dismiss);
        // A keypress counts as interaction too, so honour it rather than
        // stranding a keyboard player behind a veil they cannot click away.
        this.input.keyboard?.once('keydown', dismiss);
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
            tutorial: this.createSpriteButton(320, 174, t(this, 'ui.menu.tutorial'), () => this.startTutorial()),
            testSite: this.createSpriteButton(320, 206, t(this, 'ui.menu.testSite'), () => this.startTestSite()),
            testOptions: this.createSpriteButton(320, 238, t(this, 'ui.menu.testOptions'), () => this.showTestOptionsMenu()),
            // Cog tucked into the top-right corner (32x32, 6px margin).
            options: this.createIconButton(618, 22, 'optionsButton', () => this.showOptionsMenu()),
        };
    }

    refreshMainMenuText() {
        if (!this.mainMenuButtons) return;
        // setText does not re-fit, so a longer translation would overflow the
        // plate it was measured against.
        // The cog is icon-only, so its entry carries no label at all. Refitting
        // it threw, and because the throw landed inside cycleLanguage() the
        // options screen never reached its own refresh — the language changed
        // everywhere except the window you changed it from.
        const refit = (entry) => entry?.text && fitLabel(
            entry.text.setFontSize(MENU_LABEL_PX), MENU_PLATE_LABEL_W, MENU_LABEL_PX);
        this.mainMenuButtons.newRun.text.setText(t(this, 'ui.menu.newRun'));
        this.mainMenuButtons.continue.text.setText(t(this, 'ui.menu.continue'));
        this.mainMenuButtons.tutorial.text.setText(t(this, 'ui.menu.tutorial'));
        this.mainMenuButtons.testSite.text.setText(t(this, 'ui.menu.testSite'));
        // Options is the cog icon now — a glyph, nothing to translate.
        if (this.mainMenuButtons.testOptions) {
            this.mainMenuButtons.testOptions.text.setText(t(this, 'ui.menu.testOptions'));
        }
        Object.values(this.mainMenuButtons).forEach(refit);
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

        const txt = this.add
            .text(x, y, label, serifStyle(MENU_LABEL_PX, disabled ? '#888888' : '#ffffff'))
            .setOrigin(0.5);
        // The plate is 90px, drawn when these labels were in the much narrower
        // pixel font. Translated labels are wider, so let them shrink to fit.
        fitLabel(txt, MENU_PLATE_LABEL_W, MENU_LABEL_PX);

        if (!disabled) {
            // A release from the tutorial's Back button can land on this menu.
            // Only activate a gesture that began on this button.
            let pressedPointer = null;
            btn.setInteractive({ useHandCursor: true })
                .on('pointerover', () => {
                    SoundHelper.playVariant(this, 'hover_button', 0.4);
                    // Lighten on hover
                    if (hasSprite) btn.setTint(0xdddddd);
                })
                .on('pointerout', () => {
                    pressedPointer = null;
                    btn.clearTint();
                    if (hasSprite) btn.setTexture('nextTurnUp');
                    txt.setY(y);
                })
                .on('pointerdown', (pointer) => {
                    pressedPointer = pointer;
                    SoundHelper.playVariant(this, 'button_click', 0.5);
                    if (hasSprite) btn.setTexture('nextTurnDown');
                    txt.setY(y + 1); // subtle press down
                })
                .on('pointerup', (pointer) => {
                    const activated = pressedPointer !== null && pressedPointer === pointer;
                    pressedPointer = null;
                    if (hasSprite) btn.setTexture('nextTurnUp');
                    txt.setY(y);
                    if (activated) callback();
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

        let pressedPointer = null;
        btn.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                if (hasSprite) btn.setTint(0xdddddd);
            })
            .on('pointerout', () => {
                pressedPointer = null;
                if (hasSprite) { btn.clearTint(); btn.setFrame(0); }
                glyph?.setY(y);
            })
            .on('pointerdown', (pointer) => {
                pressedPointer = pointer;
                SoundHelper.playVariant(this, 'button_click', 0.5);
                if (hasSprite) btn.setFrame(1);
                glyph?.setY(y + 1);
            })
            .on('pointerup', (pointer) => {
                const activated = pressedPointer !== null && pressedPointer === pointer;
                pressedPointer = null;
                if (hasSprite) btn.setFrame(0);
                glyph?.setY(y);
                if (activated) callback();
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
                .on('pointerdown', () => {
                    SoundHelper.playVariant(this, 'button_click', 0.5);
                    callback();
                });
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
            SoundHelper.playVariant(this, 'button_click', 0.5);
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
        const CX = 320;
        const CY = 160;
        const panelTop = CY - OPTIONS_PANEL_H / 2;
        const panelBottom = CY + OPTIONS_PANEL_H / 2;
        const panelLeft = CX - OPTIONS_PANEL_W / 2;     // 132
        // Inset past the paper's 9-slice border before anything is placed on it.
        const pad = 20;

        // Everything the Back button has to tear down, gathered in one place so
        // a new widget can't be forgotten the way the old hand-listed array was.
        const parts = [];
        const keep = (...objects) => { parts.push(...objects.filter(Boolean)); return objects[0]; };

        // Flat ground so the main-menu art doesn't read through the paper.
        keep(this.add.rectangle(CX, CY, 640, 360, OPTIONS_BACKDROP));
        keep(this.createOptionsPanel(CX, CY));

        // Serif rather than the title-font bitmap. That bitmap is Latin-only, so
        // it dropped Cyrillic headings onto a different face mid-screen; the
        // TTF draws every language this game ships in one typeface.
        const optionsTitle = keep(this.add
            .text(CX, panelTop + 28, t(this, 'ui.options.title'),
                  serifStyle(SERIF_TITLE_PX, OPTIONS_INK))
            .setOrigin(0.5));

        const languageLabel = keep(this.add
            .text(panelLeft + 55, panelTop + 86, t(this, 'ui.options.languageLabel'),
                  serifStyle(SERIF_BODY_PX, OPTIONS_INK))
            .setOrigin(0, 0.5));
        const languageButton = this.createUiButton(CX + 32, panelTop + 90, UI_BUTTON.language,
            this.getCurrentLanguage(), {
                labelOffsetY: LANGUAGE_LABEL_OFFSET_Y,
                callback: () => {
                    this.cycleLanguage();
                    this.refreshOptionsMenuText({ optionsTitle, languageLabel, languageButton, resetButton, backButton });
                },
            });
        keep(languageButton.shadow, languageButton.button, languageButton.text, languageLabel);

        keep(OptionsSkin.createDivider.call(this, CX, panelTop + 126));

        // Each row is a tight cluster — label, then its bar, then the reading
        // underneath — so the two volumes read as two groups rather than four
        // loose lines.
        // Bar nudged right of where it sat under the bitmap font, to buy the
        // wider serif labels room. Longest label is 125px and it right-aligns to
        // barLeft - 8, leaving it clear of the panel edge in every language.
        const barX = CX + 50;
        const labelRightX = barX - UI_BUTTON_W / 2 - 8;
        this.createVolumeControl(t(this, 'ui.options.soundEffects'), panelTop + 154, 'sfx',
            { labelRightX, barX, showReading: false });
        this.createVolumeControl(t(this, 'ui.options.musicVolume'), panelTop + 181, 'music',
            { labelRightX, barX, showReading: false });

        keep(OptionsSkin.createDivider.call(this, CX, panelTop + 216));

        // Back closes the screen, so it sits centred on the paper it belongs to.
        const backButton = this.createUiButton(CX, panelBottom - 37, UI_BUTTON.back,
            t(this, 'ui.options.back'), {
                callback: () => this.closeOptionsMenu(parts),
            });
        keep(backButton.shadow, backButton.button, backButton.text);

        // Reset is destructive and doesn't belong to the settings on the page —
        // it lives in the screen's bottom-right corner, off the paper.
        const resetButton = this.createUiButton(
            640 - SCREEN_MARGIN - UI_BUTTON_W / 2,
            360 - SCREEN_MARGIN - 26,
            UI_BUTTON.reset, t(this, 'ui.options.resetAll'), {
                color: OPTIONS_RESET_INK,
                labelOffsetX: RESET_LABEL_OFFSET_X,
                // The warning badge eats the left ~27px of a 128px plate, so
                // this label has far less room than the others and shrinks
                // itself to suit. Widen the plate and it grows back on its own.
                labelWidth: UI_BUTTON_W - 38,
                callback: () => this.confirmResetProgress(),
            });
        keep(resetButton.shadow, resetButton.button, resetButton.text);

        this.optionsElements = parts;
    }

    // Paper panel behind the options controls, at the size Taya specced (376x298).
    // Falls back to a flat plate if the 9-slice art or Phaser's nineslice factory
    // is missing, same habit as the event paper.
    createOptionsPanel(...args) { return OptionsSkin.createOptionsPanel.apply(this, args); }

    // Skinned options button over a uiButtons frame. Same behaviour contract as
    // createSpriteButton — shadow, hover lighten, 1px press nudge. The sheet has
    // no pressed art yet, so the press darkens the plate instead of swapping a
    // frame; point this at a down frame if one arrives.
    createUiButton(...args) { return OptionsSkin.createUiButton.apply(this, args); }

    closeOptionsMenu(parts) {
        parts.forEach(item => item?.destroy?.());
        parts.length = 0;

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
    }

    refreshOptionsMenuText({ optionsTitle, languageLabel, languageButton, resetButton, backButton }) {
        optionsTitle.setText(t(this, 'ui.options.title'));
        languageLabel?.setText(t(this, 'ui.options.languageLabel'));
        languageButton.text.setText(this.getCurrentLanguage());
        resetButton.text.setText(t(this, 'ui.options.resetAll'));
        backButton.text.setText(t(this, 'ui.options.back'));

        if (this.volumeControls) {
            this.volumeControls.forEach(control => {
                if (control.type === 'music') {
                    control.label.setText(t(this, 'ui.options.musicVolume'));
                } else if (control.type === 'sfx') {
                    control.label.setText(t(this, 'ui.options.soundEffects'));
                }
            });
        }
    }
    
    // One labelled volume row: label, the skinned bar under it, the reading under
    // that. The filled bar is the same art as the empty one, drawn over it and
    // cropped to the current level, so the two always line up exactly.
    createVolumeControl(...args) { return OptionsSkin.createVolumeControl.apply(this, args); }

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

    startTestSite() {
        this.fadeOutMenuMusic();
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('SandboxHubScene');
        });
    }
    
    confirmResetProgress() {
        openConfirmModal(this, {
            title: t(this, 'ui.options.resetTitle'),
            body: t(this, 'ui.options.resetBody'),
            confirmLabel: t(this, 'ui.options.reset'),
            cancelLabel: t(this, 'ui.options.cancel'),
            onConfirm: () => {
                this.saveManager.clearCurrentRun();
                this.saveManager.safeRemove(this.saveManager.META_SAVE_KEY);
                this.saveManager.safeRemove('heroMemory');
                this.saveManager.safeRemove('storyProgress');
                // Restart on the next game tick so the click that confirmed the
                // reset cannot also activate a button in the rebuilt main menu.
                this.time.delayedCall(0, () => this.scene.restart());
            },
        });
    }

}

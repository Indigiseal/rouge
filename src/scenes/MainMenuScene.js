// scenes/MainMenuScene.js
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
// uiButtons.png stacks one 128x32 button per row.
const UI_BUTTON = { language: 0, barEmpty: 1, barFill: 2, back: 3, reset: 4 };
const UI_BUTTON_W = 128;
// The bars' pointed end caps eat the first and last few pixels, so the stretch
// that actually reads as "filled" runs from x=5 to x=122 inside the 128px frame.
const BAR_TRACK_X = 5;
const BAR_TRACK_W = 117;
const OPTIONS_PANEL_W = 376;
const OPTIONS_PANEL_H = 292;
const OPTIONS_INK = '#050505';        // OPTIONS, Music Volume, Sound Effects
const OPTIONS_RESET_INK = '#ffc2a2';  // label on the red reset plate
const OPTIONS_BACKDROP = 0x4a433c;
// Reset sits in the screen's bottom-right corner, off the paper entirely.
const SCREEN_MARGIN = 8;
// The reset plate carries a warning badge on its left ~27px, so its label sits
// centred in what's left of the plate rather than on the plate's own centre.
const RESET_LABEL_OFFSET_X = 14;
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
            // The queued menu theme flushes itself once the context resumes.
            SoundHelper.resumeAudio(this);
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
        const refit = (entry) => entry && fitLabel(
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

        keep(this.add.rectangle(CX, panelTop + 126, 156, 1, 0x8e7352, 0.48));

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

        keep(this.add.rectangle(CX, panelTop + 216, 156, 1, 0x8e7352, 0.48));

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
    createOptionsPanel(x, y) {
        if (this.textures.exists('eventPaper9Slice')) {
            const addNineSlice = this.add.nineslice || this.add.nineSlice;
            if (addNineSlice) {
                try {
                    return addNineSlice.call(this.add, x, y, 'eventPaper9Slice', null,
                        OPTIONS_PANEL_W, OPTIONS_PANEL_H, 32, 32, 32, 32);
                } catch {
                    // fall through to the flat plate
                }
            }
        }
        return this.add.rectangle(x, y, OPTIONS_PANEL_W, OPTIONS_PANEL_H, 0xd8b98c)
            .setStrokeStyle(2, 0x5a3a24);
    }

    // Skinned options button over a uiButtons frame. Same behaviour contract as
    // createSpriteButton — shadow, hover lighten, 1px press nudge. The sheet has
    // no pressed art yet, so the press darkens the plate instead of swapping a
    // frame; point this at a down frame if one arrives.
    createUiButton(x, y, frame, label, { color = '#ffffff', labelOffsetX = 0, labelOffsetY = 0,
        labelSize = SERIF_BODY_PX, labelWidth = UI_BUTTON_W - 12, callback } = {}) {
        const hasSprite = this.textures.exists('uiButtons');
        const labelY = y + labelOffsetY;

        const shadow = hasSprite
            ? this.add.image(x, y + 4, 'uiButtons', frame).setOrigin(0.5).setTint(0x000000).setAlpha(0.5)
            : this.add.rectangle(x, y + 4, UI_BUTTON_W, 26, 0x000000, 0.5).setOrigin(0.5);

        const btn = hasSprite
            ? this.add.image(x, y, 'uiButtons', frame).setOrigin(0.5)
            : this.add.rectangle(x, y, UI_BUTTON_W, 26, 0x8a5a32).setStrokeStyle(1, 0x2a1a10).setOrigin(0.5);

        const txt = this.add
            .text(x + labelOffsetX, labelY, label, serifStyle(labelSize, color))
            .setOrigin(0.5);
        fitLabel(txt, labelWidth, labelSize);

        btn.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                if (hasSprite) btn.setTint(0xdddddd);
            })
            .on('pointerout', () => {
                if (hasSprite) btn.clearTint();
                txt.setY(labelY);
            })
            .on('pointerdown', () => {
                if (hasSprite) btn.setTint(0x999999);
                txt.setY(labelY + 1);
            })
            .on('pointerup', () => {
                if (hasSprite) btn.clearTint();
                txt.setY(labelY);
                callback?.();
            });

        return { button: btn, shadow, text: txt };
    }

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
    createVolumeControl(label, y, volumeType, layout = {}) {
        if (!this.volumeControls) this.volumeControls = [];

        // Labels are right-aligned against the bar, the way Taya's mockup has
        // them. At 16px the serif is far wider than the bitmap font it replaced
        // ("Volumen de música" is 125px against the old 77px), so a left-aligned
        // label ran straight into the bar.
        const { labelRightX = 282, barX = 320, showReading = true } = layout;
        const barY = y;
        const readingY = barY + 14;
        const trackX = barX - UI_BUTTON_W / 2 + BAR_TRACK_X;
        const hasSprite = this.textures.exists('uiButtons');

        const labelText = this.add
            .text(labelRightX, y, label, serifStyle(SERIF_BODY_PX, OPTIONS_INK))
            .setOrigin(1, 0.5);

        const currentVolume = this.game.globalVolume[volumeType];

        const sliderBg = hasSprite
            ? this.add.image(barX, barY, 'uiButtons', UI_BUTTON.barEmpty).setOrigin(0.5)
            : this.add.rectangle(barX, barY, BAR_TRACK_W, 12, 0x4a3526).setStrokeStyle(1, 0x2a1a10);

        const sliderFill = hasSprite
            ? this.add.image(barX, barY, 'uiButtons', UI_BUTTON.barFill).setOrigin(0.5)
            : this.add.rectangle(trackX, barY, BAR_TRACK_W * currentVolume, 12, 0x8a9a7a).setOrigin(0, 0.5);

        const handle = (this.textures.exists('volumeKnob')
            ? this.add.image(trackX, barY, 'volumeKnob').setOrigin(0.5)
            : this.add.circle(trackX, barY, 6, 0xffc2a2).setStrokeStyle(1, 0x050505))
            .setInteractive({ draggable: true, useHandCursor: true });

        const volumeText = this.add.text(barX, readingY, '', {
            fontSize: '12px',
            fill: OPTIONS_INK,
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setVisible(showReading);

        // Move the slider to a target volume (0..1) and apply it. Shared by both
        // dragging the handle and clicking anywhere on the track.
        const applyVolume = (newVolume, { silent = false } = {}) => {
            newVolume = Phaser.Math.Clamp(newVolume, 0, 1);
            const filled = BAR_TRACK_W * newVolume;
            handle.x = trackX + filled;
            this.game.globalVolume[volumeType] = newVolume;

            if (hasSprite) {
                // Crop from the frame's left edge through the filled stretch, so
                // the bar's pointed left cap stays drawn while it has any level.
                sliderFill.setVisible(newVolume > 0);
                sliderFill.setCrop(0, 0, BAR_TRACK_X + filled, 32);
            } else {
                sliderFill.width = filled;
            }
            volumeText.setText(Math.round(newVolume * 100) + '%');

            if (silent) return;

            this.saveSettings();
            if (volumeType === 'music') MusicManager.updateCurrentVolume(this);

            // Play test sound for feedback
            if (volumeType === 'sfx' && newVolume > 0) {
                SoundHelper.playSound(this, 'coin_collect', 0.3);
            }
        };

        applyVolume(currentVolume, { silent: true });

        // Click (or drag) anywhere on the track to jump the slider there — not
        // just a slow drag of the handle. The zone spans the full track.
        const sliderZone = this.add.zone(barX, barY, BAR_TRACK_W, 24)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer) => applyVolume((pointer.worldX - trackX) / BAR_TRACK_W));
        // Keep the handle above the zone so grabbing it still starts a drag.
        this.children.bringToTop(handle);

        // Handle dragging
        handle.on('drag', (pointer, dragX) => applyVolume((dragX - trackX) / BAR_TRACK_W));

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

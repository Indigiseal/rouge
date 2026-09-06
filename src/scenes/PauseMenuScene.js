// scenes/PauseMenuScene.js
import {
    OptionsSkin,
    OPTIONS_BACKDROP,
    OPTIONS_INK,
    OPTIONS_RESET_INK,
    RESET_LABEL_OFFSET_X,
    UI_BUTTON,
    UI_BUTTON_W,
} from '../ui/OptionsSkin.js';
import { FONT_SIZE, fitLabel, serifStyle } from '../ui/uiFont.js';
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
        // Station rooms render in separate scenes above GameScene. Object depth
        // cannot put this menu above them; move the whole pause scene to the top.
        this.scene.bringToTop();
        this.pausedStationScenes = [
            'ShopScene', 'RareShopScene', 'RestScene', 'AnvilScene', 'TreasureScene', 'EventScene',
        ].filter(key => this.scene.isActive(key));
        this.pausedStationScenes.forEach(key => this.scene.pause(key));

        this.volumeControls = [];
        this.overlay = this.add.rectangle(320, 180, 640, 360, OPTIONS_BACKDROP).setInteractive();
        OptionsSkin.createOptionsPanel.call(this, 320, 180);
        this.add.text(320, 62, t(this, 'ui.pause.title'), serifStyle(FONT_SIZE.heading, OPTIONS_INK))
            .setOrigin(0.5);
        this.add.text(320, 94, t(this, 'ui.pause.soundSettings'), serifStyle(FONT_SIZE.body, OPTIONS_INK))
            .setOrigin(0.5);
        // Sound effects above music, the order the options screen lists them in —
        // the same two bars in the same two places on whichever screen you open.
        const layout = { labelRightX: 298, barX: 370, showReading: false };
        OptionsSkin.createVolumeControl.call(this, t(this, 'ui.options.soundEffects'), 125, 'sfx', layout);
        OptionsSkin.createVolumeControl.call(this, t(this, 'ui.options.musicVolume'), 155, 'music', layout);
        OptionsSkin.createDivider.call(this, 320, 184);
        this.createPauseButton(246, 212, t(this, 'ui.pause.resume'), () => this.resumeGame());
        this.createPauseButton(394, 212, t(this, 'ui.pause.saveQuit'), () => this.quitToMainMenu(), true);
        this.createRecorderControls();
        this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
    }

    // Same two plates the options screen uses: the plain one, and the red one
    // with the warning badge for the button that ends the run. The badge eats
    // the plate's left ~27px, so a label on it gets less room and an offset.
    createPauseButton(x, y, label, callback, warning = false) {
        return OptionsSkin.createUiButton.call(this, x, y,
            warning ? UI_BUTTON.reset : UI_BUTTON.back, label, {
                color: warning ? OPTIONS_RESET_INK : '#ffffff',
                labelOffsetX: warning ? RESET_LABEL_OFFSET_X : 0,
                labelWidth: warning ? UI_BUTTON_W - 38 : UI_BUTTON_W - 12,
                callback,
            });
    }

    createRecorderControls() {
        this.recorderStatusText = this.add.text(320, 253, '', {
            ...serifStyle('14px', OPTIONS_INK),
            wordWrap: { width: 310 }, align: 'center',
        }).setOrigin(0.5);
        this.recorderToggleText = this.createPauseButton(246, 292, '', () => {
            humanRunRecorder.toggle(this.getRecordingScene());
            this.refreshRecorderControls();
        }).text;
        this.createPauseButton(394, 292, t(this, 'ui.pause.exportJson'), () => {
            const result = humanRunRecorder.download();
            if (!result.ok && result.reason === 'no_trace') {
                this.recorderStatusText.setText(t(this, 'ui.pause.noRecordedRun'));
            } else if (!result.ok) {
                this.recorderStatusText.setText(t(this, 'ui.pause.exportUnavailable'));
            }
        });
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
        // Record / Stop recording are different lengths, so the label is refitted
        // to the same room createPauseButton measured it against.
        if (this.recorderToggleText) {
            fitLabel(this.recorderToggleText.setFontSize(FONT_SIZE.body), UI_BUTTON_W - 12, FONT_SIZE.body);
        }
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
    
    // Shared volume controls save only audio settings in this scene.
    saveSettings() { this.applyVolumeSettings(); }

    applyVolumeSettings() {
        // Update the global sound manager volume
        this.sound.volume = this.game.globalVolume.master;
        
        // Store in localStorage for persistence
        saveVolumeSettings(this.game.globalVolume);
    }
    
    resumeGame() {
        // Resume the paused scene
        this.scene.resume(this.pausedScene);
        this.pausedStationScenes?.forEach(key => this.scene.resume(key));
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

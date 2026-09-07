import { SoundHelper } from '../audio/SoundHelper.js';
import { createOptionsCog } from '../ui/OptionsCog.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { REST_HEAL_AMOUNT } from '../content/economy/rest.js';
import { createPaintedButton } from '../ui/PaintedButton.js';
import { OptionsSkin } from '../ui/OptionsSkin.js';
import { serifStyle } from '../ui/uiFont.js';
import { t } from '../i18n/i18n.js';

// A note pinned over the top of the cave, per Taya's restMockUp: paper, a
// half-dark inset to lift the writing off the grain, then the words. Every
// number here is measured off that mockup — the paper's light border runs
// x 176-467 and y 43-156, and the inset inside it x 188-446, y 52-144.
const INK = '#f0cdaf';
const PAPER_X = 320;
const PAPER_Y = 100;
const PAPER_W = 292;
const PAPER_H = 114;
// The inset sits inside the paper's drawn border, not on it.
const INSET_W = 258;
const INSET_H = 92;
const INSET_Y = 98;
const INSET_FILL = 0x000000;
const INSET_ALPHA = 0.5;
// Three lines where the mockup has two: its title y and body y, with the second
// restore line following on the same rhythm.
const MESSAGE_Y = 68;
const HEAL_LINE_Y = 98;
const ACTION_LINE_Y = 120;
// Same corner the anvil puts its Leave button in, so the two rooms are left the
// same way.
const LEAVE_X = 568;
const LEAVE_Y = 340;

export class RestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RestScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        // Resting heals freely (heal() ignores amulet caps) — only healing
        // potions are limited by the Berserker's Warbelt.
        if (typeof this.gameState.heal === 'function') {
            this.gameState.heal(REST_HEAL_AMOUNT);
        } else {
            this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth + REST_HEAL_AMOUNT);
        }
        this.gameState.actionsLeft = this.gameState.maxActions;
        // Looping campfire crackle while resting; faded out when leaving.
        this.campfireLoop = SoundHelper.fadeInMusic(this, 'campfire_loop', 0.5, 600, true);
        this.events.once('shutdown', () => this.stopCampfireLoop(450));

        if (this.textures.exists('restFire')) {
            this.add.image(320, 180, 'restFire');
        } else {
            // The old composite room art, kept as the fallback so a missing file
            // leaves a room rather than a black screen.
            this.add.rectangle(320, 180, 640, 360, 0x1a1418);
            this.add.image(320, 92, 'restRooms', 0).setOrigin(0.5);
        }

        OptionsSkin.createPaperPanel.call(this, PAPER_X, PAPER_Y, PAPER_W, PAPER_H);
        this.add.rectangle(PAPER_X, INSET_Y, INSET_W, INSET_H, INSET_FILL, INSET_ALPHA);

        this.label(PAPER_X, MESSAGE_Y, t(this, 'ui.rest.message'), '16px');
        this.label(PAPER_X, HEAL_LINE_Y, t(this, 'ui.rest.hpRestored', { amount: REST_HEAL_AMOUNT }), '14px');
        this.label(PAPER_X, ACTION_LINE_Y, t(this, 'ui.rest.actionsRestored'), '14px');

        createOptionsCog(this, () => this.openOptions());
        createPaintedButton(this, LEAVE_X, LEAVE_Y, t(this, 'ui.hud.leave'), () => this.leave());
    }

    // The cog reaches the pause menu, which is where a run finds sound, saving
    // and quitting. It pauses this room the same way the ESC key does in a fight.
    openOptions() {
        if (this.scene.isActive('PauseMenuScene')) return;
        this.scene.launch('PauseMenuScene', { pausedScene: this.scene.key });
        this.scene.pause();
    }

    label(x, y, value, size = '14px') {
        return this.add.text(x, y, value, serifStyle(size, INK)).setOrigin(0.5);
    }

    leave() {
        // NO nextFloor() here — the map already did it.
        this.stopCampfireLoop(450);
        if (isSandboxMode(this)) {
            exitToSandboxHub(this);
            return;
        }
        this.scene.stop();
        this.scene.wake('MapViewScene');
    }

    stopCampfireLoop(fadeMs = 450) {
        if (!this.campfireLoop) return;
        const loop = this.campfireLoop;
        this.campfireLoop = null;
        SoundHelper.fadeOutMusic(this, loop, fadeMs);
    }
}

import { SoundHelper } from '../audio/SoundHelper.js';
import { exitToSandboxHub, isSandboxMode } from '../sandbox/SandboxMode.js';
import { REST_HEAL_AMOUNT } from '../content/economy/rest.js';
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
        this.add.image(320, 92, 'restRooms', 0).setOrigin(0.5);
        this.add.text(320, 165, 'You rest by the campfire.', { fontSize: '18px', fill: '#ffffff', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        this.add.text(320, 205, `+${REST_HEAL_AMOUNT} HP Restored`, { fontSize: '22px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        this.add.text(320, 240, 'Actions Fully Restored!', { fontSize: '22px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        const continueButton = this.add.text(320, 280, 'Continue to Next Floor', { fontSize: '18px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // NO nextFloor() here—map already did it
                this.stopCampfireLoop(450);
                if (isSandboxMode(this)) {
                    exitToSandboxHub(this);
                    return;
                }
                this.scene.stop(); // Close rest
                this.scene.wake('MapViewScene'); // Back to map
                console.log('Woke MapViewScene after rest');
            });
        continueButton.setOrigin(0.5);
    }

    stopCampfireLoop(fadeMs = 450) {
        if (!this.campfireLoop) return;
        const loop = this.campfireLoop;
        this.campfireLoop = null;
        SoundHelper.fadeOutMusic(this, loop, fadeMs);
    }
}

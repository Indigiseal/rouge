import { SoundHelper } from '../utils/SoundHelper.js';
export class RestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RestScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        // Resting heals freely (heal() ignores amulet caps) — only healing
        // potions are limited by the Berserker's Warbelt.
        if (typeof this.gameState.heal === 'function') {
            this.gameState.heal(20);
        } else {
            this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth + 20);
        }
        this.gameState.actionsLeft = this.gameState.maxActions;
        this.add.image(320, 92, 'restRooms', 0).setOrigin(0.5);
        this.add.text(320, 165, 'You rest by the campfire.', { fontSize: '18px', fill: '#ffffff', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        this.add.text(320, 205, '+20 HP Restored', { fontSize: '22px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        this.add.text(320, 240, 'Actions Fully Restored!', { fontSize: '22px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' }).setOrigin(0.5);
        const continueButton = this.add.text(320, 280, 'Continue to Next Floor', { fontSize: '18px', fill: '#00ff00', fontFamily: '"HoMM Pixel"' })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // NO nextFloor() here—map already did it
                this.scene.stop(); // Close rest
                this.scene.wake('MapViewScene'); // Back to map
                console.log('Woke MapViewScene after rest');
            });
        continueButton.setOrigin(0.5);
    }
}

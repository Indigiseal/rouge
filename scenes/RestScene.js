import { SoundHelper } from '../utils/SoundHelper.js';
export class RestScene extends Phaser.Scene {
    constructor() {
        super({ key: 'RestScene' });
    }

    create(data) {
        this.gameState = data.gameState;
        this.gameState.playerHealth = Math.min(this.gameState.maxHealth, this.gameState.playerHealth + 20);
        this.gameState.actionsLeft = this.gameState.maxActions;
        this.add.text(320, 100, 'You rest by the campfire.', { fontSize: '18px', fill: '#ffffff', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
        this.add.text(320, 160, '+20 HP Restored', { fontSize: '22px', fill: '#00ff00', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
        this.add.text(320, 200, 'Actions Fully Restored!', { fontSize: '22px', fill: '#00ff00', fontFamily: '"Roboto Condensed"' }).setOrigin(0.5);
        const continueButton = this.add.text(320, 280, 'Continue to Next Floor', { fontSize: '18px', fill: '#00ff00', fontFamily: '"Roboto Condensed"' })
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
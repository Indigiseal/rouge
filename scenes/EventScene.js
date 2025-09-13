// EventScene.js
export class EventScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EventScene' });
  }

  init(data) {
    this.gameState = data.gameState;
  }

  create() {
    // Dark background
    this.add.rectangle(320, 180, 640, 360, 0x1a1a2e);
    
    // Title
    this.add.text(320, 50, 'MYSTERIOUS ENCOUNTER', {
      fontSize: '24px',
      fill: '#9370db'
    }).setOrigin(0.5);
    
    // Placeholder text
    this.add.text(320, 120, 'Event system coming soon...', {
      fontSize: '16px',
      fill: '#ffffff'
    }).setOrigin(0.5);
    
    this.add.text(320, 160, 'For now, choose a bonus:', {
      fontSize: '14px',
      fill: '#cccccc'
    }).setOrigin(0.5);
    
    // Temporary choices
    const choices = [
      { text: 'Gain 10 coins', action: () => { this.gameState.coins += 10; } },
      { text: 'Heal 5 HP', action: () => { 
        this.gameState.playerHealth = Math.min(
          this.gameState.maxHealth,
          this.gameState.playerHealth + 5
        );
      }},
      { text: 'Skip', action: () => {} }
    ];
    
    choices.forEach((choice, i) => {
      const btn = this.add.rectangle(320, 220 + i * 40, 200, 35, 0x444444)
        .setStrokeStyle(2, 0x9370db)
        .setInteractive();
      
      this.add.text(320, 220 + i * 40, choice.text, {
        fontSize: '14px',
        fill: '#ffffff'
      }).setOrigin(0.5);
      
      btn.on('pointerdown', () => {
        choice.action();
        this.continueAdventure();
      });
    });
  }

  continueAdventure() {
    // NO nextFloor() here—map already did it
    this.scene.stop(); // Close event
    this.scene.wake('MapViewScene'); // Back to map
    console.log('Woke MapViewScene after event');
  }
}
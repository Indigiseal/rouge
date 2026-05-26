// EventScene.js
// Unknown encounter events. Each event has a title, description, and a list of choices.
// Choices can have a condition (function returning bool) that disables them if not met.
// After a choice is made, an optional outcome message is shown before returning to the map.
// To add new events, add objects to the EVENTS array below.

const EVENTS = [
  {
    id: 'placeholder_a',
    title: 'MYSTERIOUS ENCOUNTER',
    description: 'A strange presence fills the air.\nSomething is waiting here...',
    choices: [
      {
        text: 'Gain 10 coins',
        action: (gs) => { gs.coins += 10; },
        outcome: 'You pocket the coins and move on.'
      },
      {
        text: 'Heal 5 HP',
        action: (gs) => {
          gs.playerHealth = Math.min(gs.maxHealth, gs.playerHealth + 5);
        },
        outcome: 'You rest briefly and feel a little better.'
      },
      {
        text: 'Leave',
        action: () => {},
        outcome: 'You decide not to linger.'
      }
    ]
  }
  // More events will be added here
];

export class EventScene extends Phaser.Scene {
  constructor() {
    super({ key: 'EventScene' });
  }

  init(data) {
    this.gameState = data.gameState;
    this.event = this._pickEvent();
    this.resolved = false;
  }

  _pickEvent() {
    return EVENTS[Math.floor(Math.random() * EVENTS.length)];
  }

  create() {
    const W = 640, H = 360;
    const PURPLE = '#9370db';
    const GOLD   = '#f2d3aa';
    const WHITE  = '#ffffff';
    const MUTED  = '#aaaaaa';

    // Background
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1a2e);
    this.add.rectangle(W / 2, 35, W, 70, 0x12122a);

    // Title
    this.add.text(W / 2, 35, this.event.title, {
      fontSize: '22px', fill: PURPLE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5);

    // Description
    this.descText = this.add.text(W / 2, 110, this.event.description, {
      fontSize: '14px', fill: GOLD, fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: 520 }
    }).setOrigin(0.5);

    // Divider
    this.add.rectangle(W / 2, 155, 480, 1, 0x3a2a5a);

    // Choice buttons
    this._choiceBtns = [];
    this._buildChoices();

    // Outcome text (hidden until a choice is made)
    this.outcomeText = this.add.text(W / 2, 310, '', {
      fontSize: '13px', fill: '#88ff88', fontFamily: '"HoMM Pixel"',
      align: 'center', wordWrap: { width: 500 }
    }).setOrigin(0.5).setAlpha(0);

    // Continue button (hidden until resolved)
    this.continueBtn = this.add.rectangle(W / 2, 340, 180, 32, 0x2a1a4a)
      .setStrokeStyle(2, 0x9370db)
      .setInteractive({ useHandCursor: true })
      .setAlpha(0);
    this.continueBtnText = this.add.text(W / 2, 340, 'Continue', {
      fontSize: '14px', fill: WHITE, fontFamily: '"HoMM Pixel"'
    }).setOrigin(0.5).setAlpha(0);

    this.continueBtn.on('pointerdown', () => this.continueAdventure());
    this.continueBtn.on('pointerover', () => this.continueBtn.setFillStyle(0x3a2a5a));
    this.continueBtn.on('pointerout',  () => this.continueBtn.setFillStyle(0x2a1a4a));
  }

  _buildChoices() {
    const startY = 185;
    const gap    = 42;

    this.event.choices.forEach((choice, i) => {
      const y = startY + i * gap;
      const disabled = choice.condition && !choice.condition(this.gameState);

      const bg = this.add.rectangle(320, y, 460, 34, disabled ? 0x222222 : 0x2a1a3a)
        .setStrokeStyle(1, disabled ? 0x444444 : 0x9370db);

      const label = this.add.text(320, y, choice.text, {
        fontSize: '13px',
        fill: disabled ? '#555555' : '#ffffff',
        fontFamily: '"HoMM Pixel"'
      }).setOrigin(0.5);

      if (!disabled) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x3d2060); });
        bg.on('pointerout',  () => { bg.setFillStyle(0x2a1a3a); });
        bg.on('pointerdown', () => this._resolve(choice, bg, label, i));
      }

      this._choiceBtns.push({ bg, label });
    });
  }

  _resolve(choice, activeBg, activeLabel, choiceIdx) {
    if (this.resolved) return;
    this.resolved = true;

    // Apply the effect
    choice.action(this.gameState);

    // Highlight chosen, fade the rest
    this._choiceBtns.forEach(({ bg, label }, i) => {
      if (i === choiceIdx) {
        bg.setFillStyle(0x4a2a7a).setStrokeStyle(2, 0xf2d3aa);
        bg.removeInteractive();
      } else {
        bg.setAlpha(0.3);
        label.setAlpha(0.3);
        bg.removeInteractive();
      }
    });

    // Show outcome and continue button
    if (choice.outcome) {
      this.outcomeText.setText(choice.outcome);
      this.tweens.add({ targets: this.outcomeText, alpha: 1, duration: 300 });
    }
    this.tweens.add({
      targets: [this.continueBtn, this.continueBtnText],
      alpha: 1, duration: 300, delay: choice.outcome ? 400 : 0
    });
  }

  continueAdventure() {
    this.scene.stop();
    this.scene.wake('MapViewScene');
  }
}

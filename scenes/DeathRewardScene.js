// scenes/DeathRewardScene.js
import { t, translateDescription, translateItemName } from '../utils/i18n.js';

export class DeathRewardScene extends Phaser.Scene {
    constructor() {
        super({ key: 'DeathRewardScene' });
    }
    
    init(data) {
        this.killedBy = data.killedBy || 'Unknown Enemy';
        this.floor = data.floor || 1;
        this.metaManager = data.metaManager;
    }
    
    create() {
        // Dark overlay
        this.add.rectangle(320, 180, 640, 360, 0x000000, 0.9);
        
        // Death message
        this.add.text(320, 40, t(this, 'ui.death.fallen'), {
            fontSize: '32px',
            fill: '#ff0000',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.add.text(320, 70, t(this, 'ui.death.killedBy', { enemy: this.killedBy, floor: this.floor }), {
            fontSize: '16px',
            fill: '#cccccc',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
        
        // Process death and get relic reward
        const newRelic = this.metaManager.handlePlayerDeath(this.killedBy, this.floor);
        
        if (newRelic) {
            this.showRelicReward(newRelic);
        } else {
            this.showNoReward();
        }
        
        // Show stats
        this.showDeathStats();
        
        // Continue button
        const continueButton = this.add.rectangle(320, 320, 150, 40, 0x444444)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true })
            .on('pointerover', () => continueButton.setFillStyle(0x666666))
            .on('pointerout', () => continueButton.setFillStyle(0x444444))
            .on('pointerdown', () => this.returnToMenu());
        
        this.add.text(320, 320, t(this, 'ui.common.continue'), {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
    }
    
    showRelicReward(relic) {
        // Relic unlock banner
        const banner = this.add.rectangle(320, 150, 400, 120, 0x2c1810)
            .setStrokeStyle(3, 0xffd700);
        
        this.add.text(320, 120, t(this, 'ui.death.newRelic'), {
            fontSize: '20px',
            fill: '#ffd700',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        const relicIconX = 202;
        const iconBg = this.add.circle(relicIconX, 150, 25, 0x444444)
            .setStrokeStyle(2, 0xffd700);
        const usesSheet = relic.iconSheet && this.textures.exists(relic.iconSheet);
        if (usesSheet) {
            this.add.image(relicIconX, 150, relic.iconSheet, relic.iconFrame);
        } else if (relic.icon && this.textures.exists(relic.icon)) {
            this.add.image(relicIconX, 150, relic.icon);
        }
        
        // Relic name and description
        this.add.text(320, 150, translateItemName(this, relic), {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
        
        this.add.text(320, 195, translateDescription(this, relic.description), {
            fontSize: '14px',
            fill: '#aaaaaa',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            wordWrap: { width: 350 },
            align: 'center'
        }).setOrigin(0.5);
        
        // Animate the unlock
        this.tweens.add({
            targets: [banner, iconBg],
            scale: { from: 0, to: 1 },
            duration: 500,
            ease: 'Back.easeOut'
        });
        
        // Particle effect
        this.createUnlockParticles();
    }
    
    showNoReward() {
        this.add.text(320, 150, t(this, 'ui.death.noRelic'), {
            fontSize: '16px',
            fill: '#888888',
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5);
        
        this.add.text(320, 175, t(this, 'ui.death.tryDifferent'), {
            fontSize: '14px',
            fill: '#666666',
            fontFamily: '"HoMM Pixel", Arial, sans-serif',
            wordWrap: { width: 350 },
            align: 'center'
        }).setOrigin(0.5);
    }
    
    showDeathStats() {
        const stats = [
            t(this, 'ui.death.totalDeaths', { amount: this.metaManager.totalDeaths }),
            t(this, 'ui.death.bestFloor', { floor: this.metaManager.bestFloor }),
            t(this, 'ui.death.relicsUnlocked', { amount: this.metaManager.unlockedRelics.length })
        ];
        
        stats.forEach((stat, i) => {
            this.add.text(320, 230 + i * 20, stat, {
                fontSize: '14px',
                fill: '#aaaaaa',
                fontFamily: '"HoMM Pixel", Arial, sans-serif'
            }).setOrigin(0.5);
        });
    }
    
    createUnlockParticles() {
        for (let i = 0; i < 10; i++) {
            const particle = this.add.circle(
                320 + Phaser.Math.Between(-50, 50),
                150 + Phaser.Math.Between(-30, 30),
                3,
                0xffd700
            );
            
            this.tweens.add({
                targets: particle,
                y: particle.y - 50,
                alpha: 0,
                duration: 1000,
                delay: i * 50,
                ease: 'Cubic.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }
    
    returnToMenu() {
        this.scene.start('MainMenuScene');
    }
}
